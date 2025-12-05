import { GuildMember, MessageReaction, User } from 'discord.js'
import { RoleGroup, GroupRole, RoleMenu, TemporaryRole, IRoleGroup, IGroupRole, IRoleMenu } from '../database/RoleGroup'
import Vikala from '../client/vikala'
import ms from 'ms'

interface CreateGroupOptions {
    name: string
    mode: 'single' | 'multiple' | 'limited'
    minRoles?: number
    maxRoles?: number
    requiredRoles?: string[]
    ignoredRoles?: string[]
    removeRoles?: string[]
    temporaryDuration?: number
}

interface EmojiData {
    emoji?: string
    emojiId?: string
    emojiName?: string
}

export default class RoleGroupManager {
    client: Vikala

    constructor(client: Vikala) {
        this.client = client
        this.startCleanupInterval()
    }

    private startCleanupInterval(): void {
        setInterval(async () => { await this.cleanupExpiredRoles() }, ms('5m'))
    }

    private async cleanupExpiredRoles(): Promise<void> {
        try {
            const expiredRoles = await TemporaryRole.find({
                expiresAt: { $lt: new Date() }
            })

            for (const tempRole of expiredRoles) {
                const guild = this.client.guilds.cache.get(tempRole.guildId)
                if (!guild) continue

                try {
                    const member = await guild.members.fetch(tempRole.userId)
                    if (member && member.roles.cache.has(tempRole.roleId)) {
                        await member.roles.remove(tempRole.roleId, 'Temporary role expired')
                    }
                } catch {
                }

                await TemporaryRole.deleteOne({ _id: tempRole._id })
            }

            if (expiredRoles.length > 0) {
                this.client.logger.info(`Cleaned up ${expiredRoles.length} expired temporary roles`)
            }
        } catch (error) {
            this.client.logger.error('Failed to cleanup expired roles:', error)
        }
    }

    public async createGroup(guildId: string, options: CreateGroupOptions): Promise<IRoleGroup> {
        const group = new RoleGroup({
            guildId,
            ...options,
            enabled: true
        })

        return await group.save()
    }

    public async getGroup(guildId: string, name: string): Promise<IRoleGroup | null> {
        return await RoleGroup.findOne({ guildId, name, enabled: true })
    }

    public async getGroups(guildId: string): Promise<IRoleGroup[]> {
        return await RoleGroup.find({ guildId, enabled: true }).sort({ createdAt: 1 })
    }

    public async deleteGroup(guildId: string, name: string): Promise<boolean> {
        const group = await this.getGroup(guildId, name)
        if (!group) return false

        await GroupRole.deleteMany({ groupId: group._id })
        await RoleMenu.deleteMany({ groupId: group._id })
        await RoleGroup.deleteOne({ _id: group._id })

        return true
    }

    public async addRolesToGroup(guildId: string, groupName: string, roleIds: string[]): Promise<IGroupRole[]> {
        const group = await this.getGroup(guildId, groupName)
        if (!group) throw new Error('Group not found')

        const existingRoles = await GroupRole.find({ groupId: group._id })
        const maxPosition = existingRoles.length > 0 ? Math.max(...existingRoles.map(r => r.position)) : -1

        const newRoles: IGroupRole[] = []

        for (const [index, roleId] of roleIds.entries()) {
            const existingRole = existingRoles.find(r => r.roleId === roleId)
            if (existingRole) continue

            const groupRole = new GroupRole({
                groupId: group._id,
                guildId,
                roleId,
                position: maxPosition + 1 + index,
                enabled: true
            })

            const savedRole = await groupRole.save()
            newRoles.push(savedRole)
        }

        return newRoles
    }

    public async removeRoleFromGroup(guildId: string, groupName: string, roleId: string): Promise<boolean> {
        const group = await this.getGroup(guildId, groupName)
        if (!group) return false

        const result = await GroupRole.deleteOne({ groupId: group._id, roleId })
        return result.deletedCount > 0
    }

    public async getGroupRoles(guildId: string, groupName: string): Promise<IGroupRole[]> {
        const group = await this.getGroup(guildId, groupName)
        if (!group) return []

        return await GroupRole.find({ groupId: group._id, enabled: true }).sort({ position: 1 })
    }

    public async setRoleEmoji(guildId: string, groupName: string, roleId: string, emoji: string): Promise<boolean> {
        const group = await this.getGroup(guildId, groupName)
        if (!group) return false

        const emojiData = this.parseEmojiData(emoji)
        const result = await GroupRole.updateOne(
            { groupId: group._id, roleId },
            {
                emoji: emojiData.emoji,
                emojiId: emojiData.emojiId,
                emojiName: emojiData.emojiName
            }
        )

        return result.modifiedCount > 0
    }

    public async validateGroupAccess(member: GuildMember, group: IRoleGroup): Promise<boolean> {
        if (group.requiredRoles && group.requiredRoles.length > 0) {
            const hasAllRequired = group.requiredRoles.every(roleId =>
                member.roles.cache.has(roleId)
            )
            if (!hasAllRequired) return false
        }

        if (group.ignoredRoles && group.ignoredRoles.length > 0) {
            const hasIgnoredRole = group.ignoredRoles.some(roleId =>
                member.roles.cache.has(roleId)
            )
            if (hasIgnoredRole) return false
        }

        return true
    }

    public async validateRoleLimits(member: GuildMember, group: IRoleGroup, groupRoles: IGroupRole[]): Promise<boolean> {
        const memberGroupRoles = groupRoles.filter(gr => member.roles.cache.has(gr.roleId))

        if (group.mode === 'single' && memberGroupRoles.length >= 1) {
            return false
        }

        if (group.mode === 'limited' && group.maxRoles) {
            if (memberGroupRoles.length >= group.maxRoles) {
                return false
            }
        }

        return true
    }

    public async handleRoleAssignment(member: GuildMember, group: IRoleGroup, groupRole: IGroupRole): Promise<void> {
        if (!await this.validateGroupAccess(member, group)) {
            return
        }

        const groupRoles = await GroupRole.find({ groupId: group._id, enabled: true })

        if (!await this.validateRoleLimits(member, group, groupRoles)) {
            return
        }

        const role = member.guild.roles.cache.get(groupRole.roleId)
        if (!role) return

        if (member.roles.cache.has(groupRole.roleId)) return

        if (group.mode === 'single') {
            for (const gr of groupRoles) {
                if (gr.roleId !== groupRole.roleId && member.roles.cache.has(gr.roleId)) {
                    const oldRole = member.guild.roles.cache.get(gr.roleId)
                    if (oldRole) {
                        await member.roles.remove(oldRole, `Role group: ${group.name} (single mode)`)
                    }
                }
            }
        }

        if (group.removeRoles && group.removeRoles.length > 0) {
            for (const removeRoleId of group.removeRoles) {
                if (member.roles.cache.has(removeRoleId)) {
                    const removeRole = member.guild.roles.cache.get(removeRoleId)
                    if (removeRole) {
                        await member.roles.remove(removeRole, `Role group: ${group.name} (remove roles)`)
                    }
                }
            }
        }

        await member.roles.add(role, `Role group: ${group.name}`)

        if (group.temporaryDuration && group.temporaryDuration > 0) {
            await this.addTemporaryRole(member.guild.id, member.id, groupRole.roleId, group.temporaryDuration)
        }
    }

    public async handleRoleRemoval(member: GuildMember, group: IRoleGroup, groupRole: IGroupRole): Promise<void> {
        const role = member.guild.roles.cache.get(groupRole.roleId)
        if (!role || !member.roles.cache.has(groupRole.roleId)) return

        await member.roles.remove(role, `Role group: ${group.name} (reaction removed)`)
        await this.removeTemporaryRole(member.guild.id, member.id, groupRole.roleId)
    }

    public async getGroupRoleByEmoji(messageId: string, emoji: string): Promise<{ group: IRoleGroup; groupRole: IGroupRole } | null> {
        const menu = await RoleMenu.findOne({ messageId })
        if (!menu) return null

        const group = await RoleGroup.findById(menu.groupId)
        if (!group || !group.enabled) return null

        let groupRole: IGroupRole | null = null

        if (emoji.includes(':')) {
            const [name, id] = emoji.split(':')
            groupRole = await GroupRole.findOne({
                groupId: group._id,
                enabled: true,
                $or: [
                    { emojiId: id },
                    { emojiName: name },
                    { emoji: emoji }
                ]
            })
        } else {
            groupRole = await GroupRole.findOne({
                groupId: group._id,
                enabled: true,
                emoji: emoji
            })
        }

        if (!groupRole) return null

        return { group, groupRole }
    }

    public parseEmojiData(emojiString: string): EmojiData {
        if (emojiString.includes(':')) {
            const parts = emojiString.split(':')
            if (parts.length >= 3) {
                return {
                    emojiId: parts[2].replace('>', ''),
                    emojiName: parts[1],
                    emoji: emojiString
                }
            }
        }

        return { emoji: emojiString }
    }

    public getEmojiString(reaction: MessageReaction): string {
        return reaction.emoji.id ?
            `<:${reaction.emoji.name}:${reaction.emoji.id}>` :
            reaction.emoji.name || ''
    }

    public async handleReactionAdd(reaction: MessageReaction, user: User): Promise<boolean> {
        if (user.bot) return false

        const emojiString = this.getEmojiString(reaction)
        const result = await this.getGroupRoleByEmoji(reaction.message.id, emojiString)

        if (!result) return false

        const member = reaction.message.guild!.members.cache.get(user.id)
        if (!member) return false

        try {
            await this.handleRoleAssignment(member, result.group, result.groupRole)
            return true
        } catch {
            return false
        }
    }

    public async handleReactionRemove(reaction: MessageReaction, user: User): Promise<boolean> {
        if (user.bot) return false

        const emojiString = this.getEmojiString(reaction)
        const result = await this.getGroupRoleByEmoji(reaction.message.id, emojiString)

        if (!result) return false

        const member = reaction.message.guild!.members.cache.get(user.id)
        if (!member) return false

        try {
            await this.handleRoleRemoval(member, result.group, result.groupRole)
            return true
        } catch {
            return false
        }
    }

    private async addTemporaryRole(guildId: string, userId: string, roleId: string, duration: number): Promise<void> {
        const expiresAt = new Date(Date.now() + duration)

        await TemporaryRole.create({
            guildId,
            userId,
            roleId,
            reactionRoleId: 'rolegroup',
            expiresAt,
            assignedAt: new Date()
        })

        setTimeout(async () => {
            try {
                const guild = this.client.guilds.cache.get(guildId)
                const member = guild?.members.cache.get(userId)
                if (member && member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId, 'Temporary role expired')
                }
                await TemporaryRole.deleteOne({ guildId, userId, roleId })
            } catch {
                // Failed to remove expired temporary role
            }
        }, duration)
    }

    private async removeTemporaryRole(guildId: string, userId: string, roleId: string): Promise<void> {
        await TemporaryRole.deleteOne({ guildId, userId, roleId })
    }

    public async createMenu(guildId: string, options: {
        groupName: string;
        channelId: string;
        messageId: string;
        title: string;
        description: string;
        disableDMs?: boolean;
        allowRoleRemoval?: boolean;
    }): Promise<IRoleMenu> {
        const group = await this.getGroup(guildId, options.groupName)
        if (!group) throw new Error('Group not found')

        const menu = new RoleMenu({
            groupId: group._id,
            guildId,
            channelId: options.channelId,
            messageId: options.messageId,
            title: options.title,
            description: options.description,
            groupName: options.groupName,
            disableDMs: options.disableDMs || false,
            allowRoleRemoval: options.allowRoleRemoval !== false
        })

        return await menu.save()
    }

    public async getMenu(guildId: string, groupName: string): Promise<IRoleMenu | null> {
        return await RoleMenu.findOne({ guildId, groupName })
    }

    public async getMenuByMessageId(guildId: string, messageId: string): Promise<IRoleMenu | null> {
        return await RoleMenu.findOne({ guildId, messageId })
    }

    public async getMenus(guildId: string): Promise<IRoleMenu[]> {
        return await RoleMenu.find({ guildId })
    }

    public async deleteMenu(guildId: string, groupName: string): Promise<boolean> {
        const result = await RoleMenu.deleteOne({ guildId, groupName })
        return result.deletedCount > 0
    }

    public async updateMenuFlags(guildId: string, groupName: string, updates: { disableDMs?: boolean; allowRoleRemoval?: boolean }): Promise<boolean> {
        const result = await RoleMenu.updateOne({ guildId, groupName }, { $set: updates })
        return result.modifiedCount > 0
    }

    public async removeRoleEmoji(guildId: string, groupName: string, emoji: string): Promise<boolean> {
        const group = await this.getGroup(guildId, groupName)
        if (!group) return false

        const result = await GroupRole.updateOne(
            { groupId: group._id, emoji },
            { $unset: { emoji: 1, emojiId: 1, emojiName: 1 } }
        )

        return result.modifiedCount > 0
    }
}