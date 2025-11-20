import { GuildMember, MessageReaction, User, TextChannel, Message } from 'discord.js'
import ReactionRole, { IReactionRole, TemporaryRole } from '../database/ReactionRole'
import Vikala from '../client/vikala'

interface ReactionRoleOptions {
    messageId: string
    channelId: string
    emoji: string
    roleId: string
    type?: 'normal' | 'unique' | 'verify' | 'temporary'
    groupId?: string
    maxUses?: number
    requiresRole?: string[]
    excludeRoles?: string[]
    temporaryDuration?: number
}

export default class ReactionRoleManager {
    private client: Vikala

    constructor(client: Vikala) {
        this.client = client
        this.startCleanupInterval()
    }

    private startCleanupInterval(): void {
        setInterval(async () => {
            await this.cleanupExpiredRoles()
        }, 5 * 60 * 1000)
    }

    public async handleReactionAdd(reaction: MessageReaction, user: User): Promise<void> {
        if (user.bot) return

        const reactionRole = await this.getReactionRole(reaction.message.guildId!, reaction.message.id, this.getEmojiString(reaction))
        if (!reactionRole || !reactionRole.enabled) return

        const member = reaction.message.guild!.members.cache.get(user.id)
        if (!member) return

        if (!(await this.validateReactionRole(member, reactionRole))) return
        await this.assignRole(member, reactionRole)
    }

    public async handleReactionRemove(reaction: MessageReaction, user: User): Promise<void> {
        if (user.bot) return

        const reactionRole = await this.getReactionRole(reaction.message.guildId!, reaction.message.id, this.getEmojiString(reaction))
        if (!reactionRole || !reactionRole.enabled) return

        const member = reaction.message.guild!.members.cache.get(user.id)
        if (!member) return

        if (reactionRole.type === 'verify') return

        await this.removeRole(member, reactionRole)
    }

    private async validateReactionRole(member: GuildMember, reactionRole: IReactionRole): Promise<boolean> {
        if (member.roles.cache.has(reactionRole.roleId)) return false

        if (reactionRole.maxUses && reactionRole.currentUses >= reactionRole.maxUses) return false

        if (reactionRole.requiresRole && reactionRole.requiresRole.length > 0) {
            const hasRequired = reactionRole.requiresRole.some(roleId => member.roles.cache.has(roleId))
            if (!hasRequired) return false
        }

        if (reactionRole.excludeRoles && reactionRole.excludeRoles.length > 0) {
            const hasExcluded = reactionRole.excludeRoles.some(roleId => member.roles.cache.has(roleId))
            if (hasExcluded) return false
        }

        if (reactionRole.type === 'unique' && reactionRole.groupId) {
            const groupRoles = await ReactionRole.find({
                guildId: member.guild.id,
                groupId: reactionRole.groupId,
                enabled: true
            })

            const hasGroupRole = groupRoles.some(role => member.roles.cache.has(role.roleId))
            if (hasGroupRole) return false
        }

        return true
    }

    private async assignRole(member: GuildMember, reactionRole: IReactionRole): Promise<void> {
        try {
            const role = member.guild.roles.cache.get(reactionRole.roleId)
            if (!role) return

            await member.roles.add(role, `Reaction role: ${reactionRole.type}`)

            if (reactionRole.maxUses) {
                await ReactionRole.updateOne(
                    { _id: reactionRole._id },
                    { $inc: { currentUses: 1 } }
                )
            }

            if (reactionRole.type === 'temporary' && reactionRole.temporaryDuration) {
                const expiresAt = new Date(Date.now() + reactionRole.temporaryDuration)

                await new TemporaryRole({
                    guildId: member.guild.id,
                    userId: member.id,
                    roleId: reactionRole.roleId,
                    reactionRoleId: reactionRole._id,
                    expiresAt
                }).save()
            }

            console.log(`Assigned reaction role ${role.name} to ${member.user.tag}`)
        } catch (error) {
            console.error(`Failed to assign reaction role: ${error}`)
        }
    }

    private async removeRole(member: GuildMember, reactionRole: IReactionRole): Promise<void> {
        try {
            const role = member.guild.roles.cache.get(reactionRole.roleId)
            if (!role) return

            await member.roles.remove(role, 'Reaction role removed')

            await TemporaryRole.deleteOne({
                guildId: member.guild.id,
                userId: member.id,
                roleId: reactionRole.roleId
            })
        } catch (error) {
            console.error(`Failed to remove reaction role: ${error}`)
        }
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
                console.log(`Cleaned up ${expiredRoles.length} expired temporary roles`)
            }
        } catch (error) {
            console.error('Failed to cleanup expired roles:', error)
        }
    }

    private async getReactionRole(guildId: string, messageId: string, emoji: string): Promise<IReactionRole | null> {
        return await ReactionRole.findOne({
            guildId,
            messageId,
            emoji,
            enabled: true
        })
    }

    private getEmojiString(reaction: MessageReaction): string {
        return reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name || ''
    }

    public async setupReactionRole(guildId: string, options: ReactionRoleOptions): Promise<IReactionRole> {
        const reactionRole = new ReactionRole({
            guildId,
            ...options,
            enabled: true
        })

        return await reactionRole.save()
    }

    public async removeReactionRole(guildId: string, messageId: string, emoji: string): Promise<boolean> {
        const result = await ReactionRole.deleteOne({
            guildId,
            messageId,
            emoji
        })
        return result.deletedCount > 0
    }

    public async getReactionRoles(guildId: string, messageId?: string): Promise<IReactionRole[]> {
        const filter: any = { guildId }
        if (messageId) filter.messageId = messageId

        return await ReactionRole.find(filter).sort({ createdAt: 1 })
    }

    public async cleanupMessage(messageId: string): Promise<number> {
        const result = await ReactionRole.deleteMany({ messageId })
        await TemporaryRole.deleteMany({
            reactionRoleId: { $in: await ReactionRole.find({ messageId }).distinct('_id') }
        })
        return result.deletedCount
    }

    public async toggleReactionRole(guildId: string, messageId: string, emoji: string, enabled: boolean): Promise<boolean> {
        const result = await ReactionRole.updateOne(
            { guildId, messageId, emoji },
            { enabled }
        )
        return result.modifiedCount > 0
    }
}