import { GuildMember, TextChannel } from 'discord.js'
import ms from 'ms'

import Vikala from '../client/vikala'
import UserLevel, { IUserLevel } from '../database/UserLevel'
import RoleReward, { IRoleReward } from '../database/RoleReward'

interface LevelingConfig {
    xpPerMessage: { min: number, max: number }
    xpCooldown: number
    levelUpChannel?: string
    levelUpMessage: string
    enabledChannels: string[]
    disabledChannels: string[]
    multiplierRoles: { [roleId: string]: number }
}

export default class LevelingManager {
    private client: Vikala
    private cooldowns = new Map<string, number>()

    constructor(client: Vikala) {
        this.client = client
    }

    public async _init() {
        const defaultConfig: LevelingConfig = {
            xpPerMessage: { min: 15, max: 25 },
            xpCooldown: ms('1m'),
            levelUpMessage: '🎉 Congratulations {user}! You reached level **{level}**!',
            enabledChannels: [],
            disabledChannels: [],
            multiplierRoles: {}
        }

        for (const [guildId] of this.client.guilds.cache) {
            const existingConfig = this.client.settings.get(guildId, 'leveling', null)
            if (!existingConfig) {
                await this.client.settings.set(guildId, 'leveling', defaultConfig)
            }
        }
    }

    public async addXP(userId: string, guildId: string, amount: number): Promise<{ leveledUp: boolean, newLevel: number, xpGained: number }> {
        let userLevel = await UserLevel.findOne({ userId, guildId })

        if (!userLevel) userLevel = new UserLevel({ userId, guildId })

        const config = this.client.settings.get(guildId, 'leveling', {
            xpPerMessage: { min: 15, max: 25 },
            xpCooldown: 60000,
            levelUpMessage: '🎉 Congratulations {user}! You reached level **{level}**!',
            enabledChannels: [],
            disabledChannels: [],
            multiplierRoles: {}
        }) as LevelingConfig
        const multiplier = this.getXPMultiplier(userId, guildId, config)
        const finalAmount = Math.floor(amount * multiplier)

        userLevel.xp += finalAmount
        userLevel.totalXp += finalAmount

        userLevel.messageCount += 1
        userLevel.lastXpGain = new Date()

        const oldLevel = userLevel.level
        const newLevel = this.calculateLevel(userLevel.totalXp)
        const leveledUp = newLevel > oldLevel

        if (leveledUp) {
            userLevel.level = newLevel
            userLevel.xp = userLevel.totalXp - this.getXPForLevel(newLevel)

            await this.handleLevelUp(userId, guildId, newLevel)
        }

        await userLevel.save()

        return { leveledUp, newLevel, xpGained: finalAmount }
    }

    public async removeXP(userId: string, guildId: string, amount: number): Promise<{ levelDecreased: boolean, newLevel: number, xpRemoved: number }> {
        let userLevel = await UserLevel.findOne({ userId, guildId })

        if (!userLevel) return { levelDecreased: false, newLevel: 0, xpRemoved: 0 }

        const oldLevel = userLevel.level
        userLevel.totalXp = Math.max(0, userLevel.totalXp - amount)

        const newLevel = this.calculateLevel(userLevel.totalXp)
        const levelDecreased = newLevel < oldLevel

        userLevel.level = newLevel
        userLevel.xp = userLevel.totalXp - this.getXPForLevel(newLevel)

        await userLevel.save()

        return { levelDecreased, newLevel, xpRemoved: amount }
    }

    public async setLevel(userId: string, guildId: string, level: number): Promise<void> {
        let userLevel = await UserLevel.findOne({ userId, guildId })

        if (!userLevel) {
            userLevel = new UserLevel({ userId, guildId })
        }

        const requiredXP = this.getXPForLevel(level)
        userLevel.level = level
        userLevel.totalXp = requiredXP
        userLevel.xp = 0

        await userLevel.save()
    }

    public async getUserLevel(userId: string, guildId: string): Promise<IUserLevel | null> {
        return await UserLevel.findOne({ userId, guildId })
    }

    public async getLeaderboard(guildId: string, limit: number = 10): Promise<IUserLevel[]> {
        return await UserLevel.find({ guildId })
            .sort({ level: -1, xp: -1 })
            .limit(limit)
    }

    public async addRoleReward(guildId: string, level: number, roleId: string, isStackable: boolean = true): Promise<void> {
        const existing = await RoleReward.findOne({ guildId, roleId })
        if (existing) {
            existing.level = level
            existing.isStackable = isStackable
            await existing.save()
        } else {
            const roleReward = new RoleReward({ guildId, level, roleId, isStackable })
            await roleReward.save()
        }
    }

    public async removeRoleReward(guildId: string, roleId: string): Promise<boolean> {
        const result = await RoleReward.deleteOne({ guildId, roleId })
        return result.deletedCount > 0
    }

    public async getRoleRewards(guildId: string): Promise<IRoleReward[]> {
        return await RoleReward.find({ guildId }).sort({ level: 1 })
    }

    async handleMessageXP(member: GuildMember | null, channel: any): Promise<void> {
        if (!member || !member.guild || member.user.bot) return
        if (!channel || channel.isDMBased?.()) return

        const userId = member.id
        const guildId = member.guild.id
        const config = this.client.settings.get(guildId, 'leveling', {
            xpPerMessage: { min: 15, max: 25 },
            xpCooldown: 60000,
            levelUpMessage: '🎉 Congratulations {user}! You reached level **{level}**!',
            enabledChannels: [],
            disabledChannels: [],
            multiplierRoles: {}
        }) as LevelingConfig

        if (!this.shouldGainXP(channel.id, config)) return

        const cooldownKey = `${userId}-${guildId}`
        const now = Date.now()
        const lastXP = this.cooldowns.get(cooldownKey) || 0

        if (now - lastXP < config.xpCooldown) return

        this.cooldowns.set(cooldownKey, now)

        const xpAmount = Math.floor(Math.random() * (config.xpPerMessage.max - config.xpPerMessage.min + 1)) + config.xpPerMessage.min
        const result = await this.addXP(userId, guildId, xpAmount)

        if (result.leveledUp) {
            await this.sendLevelUpMessage(member, channel, result.newLevel, config)
        }
    }

    private async handleLevelUp(userId: string, guildId: string, newLevel: number): Promise<void> {
        const member = await this.client.guilds.cache.get(guildId)?.members.fetch(userId)
        if (!member) return

        const roleRewards = await RoleReward.find({ guildId, level: { $lte: newLevel } }).sort({ level: 1 })

        for (const reward of roleRewards) {
            const role = member.guild.roles.cache.get(reward.roleId)
            if (!role || member.roles.cache.has(reward.roleId)) continue

            if (!reward.isStackable) {
                const otherRewards = await RoleReward.find({
                    guildId,
                    level: { $lt: reward.level },
                    isStackable: false
                })

                for (const otherReward of otherRewards) {
                    if (member.roles.cache.has(otherReward.roleId)) {
                        await member.roles.remove(otherReward.roleId)
                    }
                }
            }

            try {
                await member.roles.add(role)
            } catch {
                // Failed to add level role
            }
        }
    }

    private async sendLevelUpMessage(member: GuildMember, channel: any, newLevel: number, config: any): Promise<void> {
        if (!channel || channel.isDMBased?.()) return

        const levelUpChannel = config.levelUpChannel
            ? member.guild.channels.cache.get(config.levelUpChannel) as TextChannel
            : channel

        if (!levelUpChannel || !levelUpChannel.isSendable()) return

        const message = config.levelUpMessage
            .replace('{user}', member.toString())
            .replace('{level}', newLevel.toString())
            .replace('{username}', member.user.username)

        try {
            await levelUpChannel.send(message)
        } catch {
            // Failed to send level up message
        }
    }

    private shouldGainXP(channelId: string, config: LevelingConfig): boolean {
        if (config.disabledChannels.includes(channelId)) return false
        if (config.enabledChannels.length > 0 && !config.enabledChannels.includes(channelId)) return false
        return true
    }

    private getXPMultiplier(userId: string, guildId: string, config: LevelingConfig): number {
        const member = this.client.guilds.cache.get(guildId)?.members.cache.get(userId)
        if (!member) return 1

        let multiplier = 1

        if (config.multiplierRoles && typeof config.multiplierRoles === 'object') {
            for (const [roleId, roleMultiplier] of Object.entries(config.multiplierRoles)) {
                if (member.roles.cache.has(roleId)) {
                    multiplier = Math.max(multiplier, roleMultiplier)
                }
            }
        }

        return multiplier
    }

    private calculateLevel(totalXP: number): number {
        return Math.floor(0.1 * Math.sqrt(totalXP))
    }

    private getXPForLevel(level: number): number {
        return Math.pow(level / 0.1, 2)
    }

    public async resetUser(userId: string, guildId: string): Promise<void> {
        await UserLevel.deleteOne({ userId, guildId })
    }

    public async getGuildStats(guildId: string): Promise<{ totalUsers: number, averageLevel: number, totalMessages: number }> {
        const users = await UserLevel.find({ guildId })
        const totalUsers = users.length
        const averageLevel = totalUsers > 0 ? users.reduce((sum, user) => sum + user.level, 0) / totalUsers : 0
        const totalMessages = users.reduce((sum, user) => sum + user.messageCount, 0)

        return { totalUsers, averageLevel, totalMessages }
    }
}