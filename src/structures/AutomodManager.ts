import { GuildMember, Message, PermissionsBitField, Role } from 'discord.js'
import ms from 'ms'
import { AutomodConfig, AutomodRule, IAutomodConfig, IAutomodRule } from '../database/AutomodConfig'
import Vikala from '../client/vikala'

interface AutomodViolation {
    type: string
    reason: string
    severity: 'low' | 'medium' | 'high'
    content?: string
}

export default class AutomodManager {
    private client: Vikala
    private configCache = new Map<string, IAutomodConfig>()
    private rulesCache = new Map<string, IAutomodRule[]>()
    private userWarnings = new Map<string, Map<string, number>>()

    constructor(client: Vikala) {
        this.client = client
        this.startCleanupInterval()
    }

    public async processMessage(message: Message): Promise<void> {
        if (!message.guild || message.author.bot) return

        const config = await this.getConfig(message.guild.id)
        if (!config || !config.enabled) return

        const member = message.member
        if (!member || this.isImmune(member, config)) return

        if (this.isWhitelistedChannel(message.channel.id, config)) return

        const rules = await this.getRules(message.guild.id)
        if (!rules.length) return

        for (const rule of rules.filter(r => r.enabled)) {
            const violation = await this.checkRule(message, rule)
            if (violation) {
                await this.handleViolation(message, rule, violation)
                break
            }
        }
    }

    private isImmune(member: GuildMember, config: IAutomodConfig): boolean {
        if (member.permissions.has([PermissionsBitField.Flags.Administrator, PermissionsBitField.Flags.ManageGuild])) return true
        if (config.whitelistedRoles.some(roleId => member.roles.cache.has(roleId))) return true

        const botMember = member.guild.members.me
        if (botMember && member.roles.highest.position >= botMember.roles.highest.position) return true

        return false
    }

    private isWhitelistedChannel(channelId: string, config: IAutomodConfig): boolean {
        return config.whitelistedChannels.includes(channelId)
    }

    private async getConfig(guildId: string): Promise<IAutomodConfig | null> {
        if (this.configCache.has(guildId)) {
            return this.configCache.get(guildId)!
        }

        const config = await AutomodConfig.findOne({ guildId })
        if (config) this.configCache.set(guildId, config)

        return config
    }

    private async getRules(guildId: string): Promise<IAutomodRule[]> {
        if (this.rulesCache.has(guildId)) {
            return this.rulesCache.get(guildId)!
        }

        const rules = await AutomodRule.find({ guildId })
        this.rulesCache.set(guildId, rules)

        return rules
    }

    private async checkRule(message: Message, rule: IAutomodRule): Promise<AutomodViolation | null> {
        switch (rule.type) {
            case 'bad_words':
                return this.checkBadWords(message, rule)
            case 'caps':
                return this.checkCaps(message, rule)
            case 'spam':
                return this.checkSpam(message, rule)
            case 'invites':
                return this.checkInvites(message, rule)
            case 'attachment_spam':
                return this.checkAttachmentSpam(message, rule)
            default:
                return null
        }
    }

    private async handleViolation(message: Message, rule: IAutomodRule, violation: AutomodViolation): Promise<void> {
        try {
            if (message.deletable) await message.delete()

            const member = message.member!
            const warningKey = `${member.guild.id}-${member.id}-${rule.type}`

            if (!this.userWarnings.has(member.guild.id)) this.userWarnings.set(member.guild.id, new Map())

            const guildWarnings = this.userWarnings.get(member.guild.id)!
            const currentWarnings = guildWarnings.get(warningKey) || 0
            const newWarnings = currentWarnings + 1

            guildWarnings.set(warningKey, newWarnings)

            const shouldPunish = rule.warningsBeforeAction ? newWarnings >= rule.warningsBeforeAction : true

            if (shouldPunish) {
                await this.executePunishment(member, rule, violation.reason)
                guildWarnings.delete(warningKey)
            } else {
                await this.warnUser(member, rule, violation, newWarnings)
            }

            this.client.logger.info(`Automod violation: ${member.user.tag} - ${rule.type} - ${violation.reason}`)

        } catch (error) {
            this.client.logger.error('Failed to handle automod violation:', error)
        }
    }

    private async executePunishment(member: GuildMember, rule: IAutomodRule, reason: string): Promise<void> {
        const fullReason = `Automod: ${rule.type} - ${reason}`

        try {
            switch (rule.punishment) {
                case 'warn':
                    await this.client.cases.createCase(member.guild, {
                        action: 'WARN',
                        target: member,
                        mod: member.guild.members.me!,
                        reason: fullReason,
                        message: 'automod'
                    })
                    break

                case 'mute':
                    await this.muteUser(member, fullReason)
                    break

                case 'temp_mute':
                    await this.muteUser(member, fullReason, rule.duration)
                    break

                case 'kick':
                    if (member.kickable) {
                        await member.kick(fullReason)
                        await this.client.cases.createCase(member.guild, {
                            action: 'KICK',
                            target: member,
                            mod: member.guild.members.me!,
                            reason: fullReason,
                            message: 'automod'
                        })
                    }
                    break

                case 'ban':
                    if (member.bannable) {
                        await member.ban({ reason: fullReason })
                        await this.client.cases.createCase(member.guild, {
                            action: 'BAN',
                            target: member,
                            mod: member.guild.members.me!,
                            reason: fullReason,
                            message: 'automod'
                        })
                    }
                    break

                case 'temp_ban':
                    if (member.bannable && rule.duration) {
                        await member.ban({ reason: fullReason })
                        await this.client.cases.createCase(member.guild, {
                            action: 'BAN',
                            target: member,
                            mod: member.guild.members.me!,
                            reason: fullReason,
                            message: 'automod',
                            extras: {
                                actionDuration: new Date(Date.now() + rule.duration),
                                actionComplete: false
                            }
                        })


                        setTimeout(async () => {
                            try {
                                await member.guild.members.unban(member.id, 'Temporary ban expired')
                            } catch (error) {
                                this.client.logger.error('Failed to unban user after temp ban:', error)
                            }
                        }, rule.duration)
                    }
                    break
            }
        } catch (error) {
            this.client.logger.error(`Failed to execute automod punishment ${rule.punishment}:`, error)
        }
    }

    private async muteUser(member: GuildMember, reason: string, duration?: number): Promise<void> {
        const config = await this.getConfig(member.guild.id)
        if (!config) return

        let muteRole: Role | undefined


        if (config.muteRoleId) {
            muteRole = member.guild.roles.cache.get(config.muteRoleId)
        }


        if (!muteRole && config.autoFindMuteRole) {
            muteRole = member.guild.roles.cache.find(role =>
                ['mute', 'muted'].includes(role.name.toLowerCase())
            )
        }

        if (!muteRole) {
            this.client.logger.warn(`No mute role found for guild ${member.guild.id}`)
            return
        }

        await member.roles.add(muteRole, reason)


        const logData = {
            action: 'MUTE' as const,
            target: member,
            mod: member.guild.members.me!,
            reason: reason,
            extras: duration ? {
                actionDuration: new Date(Date.now() + duration),
                actionComplete: false
            } : undefined
        }

        await this.client.cases.createCase(member.guild, {
            ...logData,
            message: 'automod'
        })


        if (duration) {
            setTimeout(async () => {
                try {
                    if (member.roles.cache.has(muteRole!.id)) {
                        await member.roles.remove(muteRole!, 'Temporary mute expired')
                        await this.client.cases.createCase(member.guild, {
                            action: 'UNMUTE',
                            target: member,
                            mod: member.guild.members.me!,
                            reason: 'Temporary mute expired',
                            message: 'automod'
                        })
                    }
                } catch (error) {
                    this.client.logger.error('Failed to unmute user after temp mute:', error)
                }
            }, duration)
        }
    }

    private async warnUser(member: GuildMember, rule: IAutomodRule, violation: AutomodViolation, warningCount: number): Promise<void> {
        try {
            const remaining = (rule.warningsBeforeAction || 3) - warningCount
            await member.send(
                `⚠️ **Automod Warning**\n` +
                `**Server:** ${member.guild.name}\n` +
                `**Reason:** ${violation.reason}\n` +
                `**Warnings:** ${warningCount}/${rule.warningsBeforeAction || 3}\n` +
                `**Next punishment:** ${rule.punishment}${remaining > 0 ? ` (in ${remaining} more warnings)` : ''}`
            )
        } catch (error) {

        }
    }


    private checkBadWords(message: Message, rule: IAutomodRule): AutomodViolation | null {

        return null
    }

    private checkCaps(message: Message, rule: IAutomodRule): AutomodViolation | null {

        return null
    }

    private checkSpam(message: Message, rule: IAutomodRule): AutomodViolation | null {

        return null
    }

    private checkInvites(message: Message, rule: IAutomodRule): AutomodViolation | null {

        return null
    }

    private checkAttachmentSpam(message: Message, rule: IAutomodRule): AutomodViolation | null {

        return null
    }

    private startCleanupInterval(): void {
        setInterval(() => {
            this.configCache.clear()
            this.rulesCache.clear()

            for (const [guildId, guildWarnings] of this.userWarnings) {
                if (guildWarnings.size === 0) this.userWarnings.delete(guildId)
            }
        }, ms('5m'))
    }

    public async initializeGuild(guildId: string): Promise<void> {
        const existingConfig = await AutomodConfig.findOne({ guildId })
        if (existingConfig) return

        await AutomodConfig.create({ guildId })

        const defaultRules = [
            { type: 'bad_words', punishment: 'warn', warningsBeforeAction: 3 },
            { type: 'caps', punishment: 'warn', threshold: 70, warningsBeforeAction: 2 },
            { type: 'spam', punishment: 'mute', threshold: 5, warningsBeforeAction: 1 },
            { type: 'invites', punishment: 'warn', warningsBeforeAction: 2 },
            { type: 'attachment_spam', punishment: 'warn', threshold: 3, warningsBeforeAction: 2 }
        ]

        for (const ruleData of defaultRules) {
            await AutomodRule.create({
                guildId,
                ...ruleData,
                enabled: false
            })
        }

        this.client.logger.info(`Initialized automod for guild ${guildId}`)
    }
}