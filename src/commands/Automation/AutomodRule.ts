import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message } from 'discord.js'
import ms from 'ms'

import { Colors } from '../../lib/util/Colors'
import { AutomodRule, IAutomodRule } from '../../database/AutomodConfig'

@ApplyOptions<Subcommand.Options>({
    name: 'automodrule',
    aliases: ['amrule', 'rule'],
    description: 'Manage automoderation rules',
    detailedDescription: 'Configure individual automod rules including spam detection, invite blocking, caps limits, bad word filtering, and attachment spam prevention.',
    examples: [
        { example: 'rule enable spam', description: 'Enable spam detection rule.' },
        { example: 'rule disable invites', description: 'Disable invite blocking rule.' },
        { example: 'rule set spam punishment mute', description: 'Set spam punishment to mute.' },
        { example: 'rule set caps threshold 70', description: 'Set caps threshold to 70%.' },
        { example: 'rule set spam warnings 3', description: 'Require 3 warnings before punishment.' },
        { example: 'rule set spam duration 1h', description: 'Set temp mute duration to 1 hour.' },
        { example: 'rule info spam', description: 'View detailed info about spam rule.' }
    ],
    requiredUserPermissions: ['ManageGuild'],
    subcommands: [
        { name: 'enable', chatInputRun: 'chatInputEnable', messageRun: 'messageEnable' },
        { name: 'disable', chatInputRun: 'chatInputDisable', messageRun: 'messageDisable' },
        { name: 'set', chatInputRun: 'chatInputSet', messageRun: 'messageSet' },
        { name: 'info', chatInputRun: 'chatInputInfo', messageRun: 'messageInfo', default: true }
    ]
})
export class AutomodRuleCommand extends Subcommand {
    client = this.container.client

    private readonly RULE_TYPES = ['spam', 'caps', 'invites', 'bad_words', 'attachment_spam']
    private readonly PUNISHMENTS = ['warn', 'mute', 'temp_mute', 'kick', 'ban', 'temp_ban']

    public async messageEnable(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const ruleType = await args.pickResult('string')
        if (!ruleType.ok) {
            return message.channel.send(`❌ Usage: \`rule enable <${this.RULE_TYPES.join('|')}>\``)
        }

        const type = ruleType.unwrap().toLowerCase()
        if (!this.RULE_TYPES.includes(type)) {
            return message.channel.send(`❌ Invalid rule type. Valid types: ${this.RULE_TYPES.join(', ')}`)
        }

        const rule = await AutomodRule.findOne({ guildId: message.guild.id, type })
        if (!rule) {
            return message.channel.send('❌ Rule not found. Automod may not be initialized. Use `automod enable` first.')
        }

        if (rule.enabled) {
            return message.channel.send(`⚠️ The **${this.formatRuleType(type)}** rule is already enabled.`)
        }

        rule.enabled = true
        await rule.save()

        return message.channel.send(`✅ Enabled **${this.formatRuleType(type)}** rule.`)
    }

    public async chatInputEnable(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const type = interaction.options.getString('type', true)

        const rule = await AutomodRule.findOne({ guildId: interaction.guild.id, type })
        if (!rule) {
            return interaction.reply({ content: '❌ Rule not found. Automod may not be initialized. Use `/automod enable` first.', flags: ['Ephemeral'] })
        }

        if (rule.enabled) {
            return interaction.reply({ content: `⚠️ The **${this.formatRuleType(type)}** rule is already enabled.`, flags: ['Ephemeral'] })
        }

        rule.enabled = true
        await rule.save()

        return interaction.reply(`✅ Enabled **${this.formatRuleType(type)}** rule.`)
    }

    public async messageDisable(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const ruleType = await args.pickResult('string')
        if (!ruleType.ok) {
            return message.channel.send(`❌ Usage: \`rule disable <${this.RULE_TYPES.join('|')}>\``)
        }

        const type = ruleType.unwrap().toLowerCase()
        if (!this.RULE_TYPES.includes(type)) {
            return message.channel.send(`❌ Invalid rule type. Valid types: ${this.RULE_TYPES.join(', ')}`)
        }

        const rule = await AutomodRule.findOne({ guildId: message.guild.id, type })
        if (!rule) {
            return message.channel.send('❌ Rule not found.')
        }

        if (!rule.enabled) {
            return message.channel.send(`⚠️ The **${this.formatRuleType(type)}** rule is already disabled.`)
        }

        rule.enabled = false
        await rule.save()

        return message.channel.send(`✅ Disabled **${this.formatRuleType(type)}** rule.`)
    }

    public async chatInputDisable(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const type = interaction.options.getString('type', true)

        const rule = await AutomodRule.findOne({ guildId: interaction.guild.id, type })
        if (!rule) {
            return interaction.reply({ content: '❌ Rule not found.', flags: ['Ephemeral'] })
        }

        if (!rule.enabled) {
            return interaction.reply({ content: `⚠️ The **${this.formatRuleType(type)}** rule is already disabled.`, flags: ['Ephemeral'] })
        }

        rule.enabled = false
        await rule.save()

        return interaction.reply(`✅ Disabled **${this.formatRuleType(type)}** rule.`)
    }

    public async messageSet(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const ruleType = await args.pickResult('string')
        const property = await args.pickResult('string')
        const value = await args.restResult('string')

        if (!ruleType.ok || !property.ok || !value.ok) {
            return message.channel.send('❌ Usage: `rule set <type> <property> <value>`\nProperties: `punishment`, `threshold`, `warnings`, `duration`')
        }

        const type = ruleType.unwrap().toLowerCase()
        const prop = property.unwrap().toLowerCase()
        const val = value.unwrap()

        if (!this.RULE_TYPES.includes(type)) {
            return message.channel.send(`❌ Invalid rule type. Valid types: ${this.RULE_TYPES.join(', ')}`)
        }

        const rule = await AutomodRule.findOne({ guildId: message.guild.id, type })
        if (!rule) {
            return message.channel.send('❌ Rule not found.')
        }

        const result = await this.updateRuleProperty(rule, prop, val)
        if (!result.success) {
            return message.channel.send(`❌ ${result.error}`)
        }

        return message.channel.send(`✅ Updated **${this.formatRuleType(type)}** rule: ${result.message}`)
    }

    public async chatInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const type = interaction.options.getString('type', true)
        const property = interaction.options.getString('property', true)
        const value = interaction.options.getString('value', true)

        const rule = await AutomodRule.findOne({ guildId: interaction.guild.id, type })
        if (!rule) {
            return interaction.reply({ content: '❌ Rule not found.', flags: ['Ephemeral'] })
        }

        const result = await this.updateRuleProperty(rule, property, value)
        if (!result.success) {
            return interaction.reply({ content: `❌ ${result.error}`, flags: ['Ephemeral'] })
        }

        return interaction.reply(`✅ Updated **${this.formatRuleType(type)}** rule: ${result.message}`)
    }

    public async messageInfo(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const ruleType = await args.pickResult('string')
        if (!ruleType.ok) {
            return message.channel.send(`❌ Usage: \`rule info <${this.RULE_TYPES.join('|')}>\``)
        }

        const type = ruleType.unwrap().toLowerCase()
        if (!this.RULE_TYPES.includes(type)) {
            return message.channel.send(`❌ Invalid rule type. Valid types: ${this.RULE_TYPES.join(', ')}`)
        }

        const rule = await AutomodRule.findOne({ guildId: message.guild.id, type })
        if (!rule) {
            return message.channel.send('❌ Rule not found.')
        }

        const embed = this.buildRuleInfoEmbed(rule, message.guild.name, message.guild.iconURL())
        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputInfo(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const type = interaction.options.getString('type', true)

        const rule = await AutomodRule.findOne({ guildId: interaction.guild.id, type })
        if (!rule) {
            return interaction.reply({ content: '❌ Rule not found.', flags: ['Ephemeral'] })
        }

        const embed = this.buildRuleInfoEmbed(rule, interaction.guild.name, interaction.guild.iconURL())
        return interaction.reply({ embeds: [embed] })
    }

    private async updateRuleProperty(rule: IAutomodRule, property: string, value: string): Promise<{ success: boolean; message?: string; error?: string }> {
        switch (property) {
            case 'punishment':
                if (!this.PUNISHMENTS.includes(value)) {
                    return { success: false, error: `Invalid punishment. Valid: ${this.PUNISHMENTS.join(', ')}` }
                }
                rule.punishment = value as IAutomodRule['punishment']
                await rule.save()
                return { success: true, message: `Set punishment to **${value}**` }

            case 'threshold':
                const threshold = parseInt(value)
                if (isNaN(threshold) || threshold < 1) {
                    return { success: false, error: 'Threshold must be a positive number' }
                }
                rule.threshold = threshold
                await rule.save()
                return { success: true, message: `Set threshold to **${threshold}**` }

            case 'warnings':
                const warnings = parseInt(value)
                if (isNaN(warnings) || warnings < 1) {
                    return { success: false, error: 'Warnings must be a positive number' }
                }
                rule.warningsBeforeAction = warnings
                await rule.save()
                return { success: true, message: `Set warnings before action to **${warnings}**` }

            case 'duration':
                const durationMs = ms(value as any)
                if (typeof durationMs !== 'number') {
                    return { success: false, error: 'Invalid duration format. Examples: 1h, 30m, 1d' }
                }
                rule.duration = durationMs
                await rule.save()
                return { success: true, message: `Set duration to **${ms(durationMs, { long: true })}**` }
            default:
                return { success: false, error: `Invalid property. Valid: punishment, threshold, warnings, duration` }
        }
    }

    private buildRuleInfoEmbed(rule: IAutomodRule, guildName: string, guildIcon: string | null): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor(rule.enabled ? Colors.Green : Colors.Red)
            .setAuthor({ name: `${guildName} | ${this.formatRuleType(rule.type)} Rule`, iconURL: guildIcon || undefined })
            .setTimestamp()

        const statusEmoji = rule.enabled ? '✅' : '❌'
        let info = `${statusEmoji} **Status:** ${rule.enabled ? 'Enabled' : 'Disabled'}\n\n`
        info += `**Punishment:** ${rule.punishment}\n`

        if (rule.threshold) {
            info += `**Threshold:** ${rule.threshold}${rule.type === 'caps' ? '%' : ''}\n`
        }

        if (rule.warningsBeforeAction) {
            info += `**Warnings Before Action:** ${rule.warningsBeforeAction}\n`
        }

        if (rule.duration) {
            info += `**Duration:** ${ms(rule.duration, { long: true })}\n`
        }

        info += `\n**Description:**\n${this.getRuleDescription(rule.type)}`

        embed.setDescription(info)
        return embed
    }

    private getRuleDescription(type: string): string {
        const descriptions: Record<string, string> = {
            'spam': 'Detects users sending multiple messages in quick succession.',
            'caps': 'Detects messages with excessive capital letters above the threshold.',
            'invites': 'Blocks Discord server invite links in messages.',
            'bad_words': 'Filters messages containing blacklisted words or phrases.',
            'attachment_spam': 'Detects users sending too many attachments rapidly.'
        }
        return descriptions[type] || 'No description available.'
    }

    private formatRuleType(type: string): string {
        const types: Record<string, string> = {
            'spam': 'Spam',
            'caps': 'Excessive Caps',
            'invites': 'Discord Invites',
            'bad_words': 'Bad Words',
            'attachment_spam': 'Attachment Spam'
        }
        return types[type] || type
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('automodrule')
                .setDescription('Manage automoderation rules')
                .addSubcommand((sub) =>
                    sub.setName('enable')
                        .setDescription('Enable an automod rule')
                        .addStringOption((opt) =>
                            opt.setName('type')
                                .setDescription('The rule type to enable')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Spam', value: 'spam' },
                                    { name: 'Excessive Caps', value: 'caps' },
                                    { name: 'Discord Invites', value: 'invites' },
                                    { name: 'Bad Words', value: 'bad_words' },
                                    { name: 'Attachment Spam', value: 'attachment_spam' }
                                )
                        )
                )
                .addSubcommand((sub) =>
                    sub.setName('disable')
                        .setDescription('Disable an automod rule')
                        .addStringOption((opt) =>
                            opt.setName('type')
                                .setDescription('The rule type to disable')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Spam', value: 'spam' },
                                    { name: 'Excessive Caps', value: 'caps' },
                                    { name: 'Discord Invites', value: 'invites' },
                                    { name: 'Bad Words', value: 'bad_words' },
                                    { name: 'Attachment Spam', value: 'attachment_spam' }
                                )
                        )
                )
                .addSubcommand((sub) =>
                    sub.setName('set')
                        .setDescription('Configure a rule property')
                        .addStringOption((opt) =>
                            opt.setName('type')
                                .setDescription('The rule type')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Spam', value: 'spam' },
                                    { name: 'Excessive Caps', value: 'caps' },
                                    { name: 'Discord Invites', value: 'invites' },
                                    { name: 'Bad Words', value: 'bad_words' },
                                    { name: 'Attachment Spam', value: 'attachment_spam' }
                                )
                        )
                        .addStringOption((opt) =>
                            opt.setName('property')
                                .setDescription('The property to set')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Punishment', value: 'punishment' },
                                    { name: 'Threshold', value: 'threshold' },
                                    { name: 'Warnings', value: 'warnings' },
                                    { name: 'Duration', value: 'duration' }
                                )
                        )
                        .addStringOption((opt) =>
                            opt.setName('value')
                                .setDescription('The value to set (e.g., "mute", "70", "3", "1h")')
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub.setName('info')
                        .setDescription('View detailed information about a rule')
                        .addStringOption((opt) =>
                            opt.setName('type')
                                .setDescription('The rule type to view')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Spam', value: 'spam' },
                                    { name: 'Excessive Caps', value: 'caps' },
                                    { name: 'Discord Invites', value: 'invites' },
                                    { name: 'Bad Words', value: 'bad_words' },
                                    { name: 'Attachment Spam', value: 'attachment_spam' }
                                )
                        )
                )
        )
    }
}
