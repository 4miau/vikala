import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, Role, TextChannel } from 'discord.js'
import ms from 'ms'

import { Colors } from '../../lib/util/Colors'
import { AutomodConfig, AutomodRule } from '../../database/AutomodConfig'

@ApplyOptions<Subcommand.Options>({
    name: 'automod',
    aliases: ['am'],
    description: 'Configure and manage automoderation system',
    detailedDescription: 'Comprehensive automoderation system with configurable rules for spam, invites, caps, bad words, and attachments. Features automatic punishments and customizable thresholds.',
    examples: [
        { example: 'automod enable', description: 'Enable automoderation for this server.' },
        { example: 'automod disable', description: 'Disable automoderation for this server.' },
        { example: 'automod status', description: 'View current automod configuration and rules.' },
        { example: 'automod muterole @Muted', description: 'Set the mute role for automod punishments.' },
        { example: 'automod muterole auto', description: 'Automatically find mute role by name.' },
        { example: 'automod whitelist add #general', description: 'Add channel to automod whitelist.' },
        { example: 'automod whitelist remove #general', description: 'Remove channel from whitelist.' },
        { example: 'automod whiterole add @Moderator', description: 'Whitelist role from automod checks.' },
        { example: 'automod whiterole remove @Moderator', description: 'Remove role from whitelist.' }
    ],
    requiredUserPermissions: ['ManageGuild'],
    requiredClientPermissions: ['ManageRoles', 'ModerateMembers'],
    subcommands: [
        { name: 'enable', chatInputRun: 'chatInputEnable', messageRun: 'messageEnable' },
        { name: 'disable', chatInputRun: 'chatInputDisable', messageRun: 'messageDisable' },
        { name: 'status', chatInputRun: 'chatInputStatus', messageRun: 'messageStatus', default: true },
        { name: 'muterole', chatInputRun: 'chatInputMuteRole', messageRun: 'messageMuteRole' },
        { name: 'whitelist', chatInputRun: 'chatInputWhitelist', messageRun: 'messageWhitelist' },
        { name: 'whiterole', chatInputRun: 'chatInputWhiteRole', messageRun: 'messageWhiteRole' }
    ]
})
export class AutomodCommand extends Subcommand {
    client = this.container.client

    public async messageEnable(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const config = await AutomodConfig.findOne({ guildId: message.guild.id })

        if (!config) {
            await this.client.automod.initializeGuild(message.guild.id)
            return message.channel.send('✅ Automod has been initialized and enabled! Use `automod status` to view configuration.')
        }

        if (config.enabled) {
            return message.channel.send('⚠️ Automod is already enabled for this server.')
        }

        config.enabled = true
        await config.save()

        return message.channel.send('✅ Automod has been **enabled** for this server.')
    }

    public async chatInputEnable(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const config = await AutomodConfig.findOne({ guildId: interaction.guild.id })

        if (!config) {
            await this.client.automod.initializeGuild(interaction.guild.id)
            return interaction.reply('✅ Automod has been initialized and enabled! Use `/automod status` to view configuration.')
        }

        if (config.enabled) {
            return interaction.reply({ content: '⚠️ Automod is already enabled for this server.', flags: ['Ephemeral'] })
        }

        config.enabled = true
        await config.save()

        return interaction.reply('✅ Automod has been **enabled** for this server.')
    }

    public async messageDisable(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const config = await AutomodConfig.findOne({ guildId: message.guild.id })

        if (!config || !config.enabled) {
            return message.channel.send('⚠️ Automod is not currently enabled.')
        }

        config.enabled = false
        await config.save()

        return message.channel.send('✅ Automod has been **disabled** for this server.')
    }

    public async chatInputDisable(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const config = await AutomodConfig.findOne({ guildId: interaction.guild.id })

        if (!config || !config.enabled) {
            return interaction.reply({ content: '⚠️ Automod is not currently enabled.', flags: ['Ephemeral'] })
        }

        config.enabled = false
        await config.save()

        return interaction.reply('✅ Automod has been **disabled** for this server.')
    }

    public async messageStatus(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const config = await AutomodConfig.findOne({ guildId: message.guild.id })

        if (!config) {
            return message.channel.send('⚠️ Automod has not been set up yet. Use `automod enable` to initialize.')
        }

        const rules = await AutomodRule.find({ guildId: message.guild.id })
        const embed = this.buildStatusEmbed(config, rules, message.guild.name, message.guild.iconURL())

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputStatus(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const config = await AutomodConfig.findOne({ guildId: interaction.guild.id })

        if (!config) {
            return interaction.reply({ content: '⚠️ Automod has not been set up yet. Use `/automod enable` to initialize.', flags: ['Ephemeral'] })
        }

        const rules = await AutomodRule.find({ guildId: interaction.guild.id })
        const embed = this.buildStatusEmbed(config, rules, interaction.guild.name, interaction.guild.iconURL())

        return interaction.reply({ embeds: [embed] })
    }

    public async messageMuteRole(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const input = await args.restResult('string')
        if (!input.ok) {
            return message.channel.send('❌ Usage: `automod muterole <@role|roleID|auto>`')
        }

        const config = await this.ensureConfig(message.guild.id)
        const value = input.unwrap()

        if (value.toLowerCase() === 'auto') {
            config.autoFindMuteRole = true
            config.muteRoleId = undefined
            await config.save()
            return message.channel.send('✅ Automod will now automatically find the mute role.')
        }

        const role = await args.pick('role').catch(() => null)
        if (!role) {
            return message.channel.send('❌ Invalid role provided.')
        }

        config.muteRoleId = role.id
        config.autoFindMuteRole = false
        await config.save()

        return message.channel.send(`✅ Mute role set to ${role}.`)
    }

    public async chatInputMuteRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const role = interaction.options.getRole('role') as Role | null
        const auto = interaction.options.getBoolean('auto')

        const config = await this.ensureConfig(interaction.guild.id)

        if (auto) {
            config.autoFindMuteRole = true
            config.muteRoleId = undefined
            await config.save()
            return interaction.reply('✅ Automod will now automatically find the mute role.')
        }

        if (!role) {
            return interaction.reply({ content: '❌ Please provide a role or enable auto mode.', flags: ['Ephemeral'] })
        }

        config.muteRoleId = role.id
        config.autoFindMuteRole = false
        await config.save()

        return interaction.reply(`✅ Mute role set to ${role}.`)
    }

    public async messageWhitelist(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const action = await args.pickResult('string')
        if (!action.ok) {
            return message.channel.send('❌ Usage: `automod whitelist <add|remove> <#channel|channelID>`')
        }

        const actionType = action.unwrap().toLowerCase()
        if (!['add', 'remove'].includes(actionType)) {
            return message.channel.send('❌ Action must be `add` or `remove`.')
        }

        const channel = await args.pickResult('sendablechannel')
        if (!channel.ok) {
            return message.channel.send('❌ Please provide a valid channel.')
        }

        const config = await this.ensureConfig(message.guild.id)
        const targetChannel = channel.unwrap() as TextChannel

        if (actionType === 'add') {
            if (config.whitelistedChannels.includes(targetChannel.id)) {
                return message.channel.send('⚠️ Channel is already whitelisted.')
            }
            config.whitelistedChannels.push(targetChannel.id)
            await config.save()
            return message.channel.send(`✅ Added ${targetChannel} to automod whitelist.`)
        } else {
            const index = config.whitelistedChannels.indexOf(targetChannel.id)
            if (index === -1) {
                return message.channel.send('⚠️ Channel is not in whitelist.')
            }
            config.whitelistedChannels.splice(index, 1)
            await config.save()
            return message.channel.send(`✅ Removed ${targetChannel} from automod whitelist.`)
        }
    }

    public async chatInputWhitelist(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const action = interaction.options.getString('action', true)
        const channel = interaction.options.getChannel('channel', true) as TextChannel

        const config = await this.ensureConfig(interaction.guild.id)

        if (action === 'add') {
            if (config.whitelistedChannels.includes(channel.id)) {
                return interaction.reply({ content: '⚠️ Channel is already whitelisted.', flags: ['Ephemeral'] })
            }
            config.whitelistedChannels.push(channel.id)
            await config.save()
            return interaction.reply(`✅ Added ${channel} to automod whitelist.`)
        } else {
            const index = config.whitelistedChannels.indexOf(channel.id)
            if (index === -1) {
                return interaction.reply({ content: '⚠️ Channel is not in whitelist.', flags: ['Ephemeral'] })
            }
            config.whitelistedChannels.splice(index, 1)
            await config.save()
            return interaction.reply(`✅ Removed ${channel} from automod whitelist.`)
        }
    }

    public async messageWhiteRole(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const action = await args.pickResult('string')
        if (!action.ok) {
            return message.channel.send('❌ Usage: `automod whiterole <add|remove> <@role|roleID>`')
        }

        const actionType = action.unwrap().toLowerCase()
        if (!['add', 'remove'].includes(actionType)) {
            return message.channel.send('❌ Action must be `add` or `remove`.')
        }

        const role = await args.pickResult('role')
        if (!role.ok) {
            return message.channel.send('❌ Please provide a valid role.')
        }

        const config = await this.ensureConfig(message.guild.id)
        const targetRole = role.unwrap()

        if (actionType === 'add') {
            if (config.whitelistedRoles.includes(targetRole.id)) {
                return message.channel.send('⚠️ Role is already whitelisted.')
            }
            config.whitelistedRoles.push(targetRole.id)
            await config.save()
            return message.channel.send(`✅ Added ${targetRole} to automod whitelist.`)
        } else {
            const index = config.whitelistedRoles.indexOf(targetRole.id)
            if (index === -1) {
                return message.channel.send('⚠️ Role is not in whitelist.')
            }
            config.whitelistedRoles.splice(index, 1)
            await config.save()
            return message.channel.send(`✅ Removed ${targetRole} from automod whitelist.`)
        }
    }

    public async chatInputWhiteRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const action = interaction.options.getString('action', true)
        const role = interaction.options.getRole('role', true) as Role

        const config = await this.ensureConfig(interaction.guild.id)

        if (action === 'add') {
            if (config.whitelistedRoles.includes(role.id)) {
                return interaction.reply({ content: '⚠️ Role is already whitelisted.', flags: ['Ephemeral'] })
            }
            config.whitelistedRoles.push(role.id)
            await config.save()
            return interaction.reply(`✅ Added ${role} to automod whitelist.`)
        } else {
            const index = config.whitelistedRoles.indexOf(role.id)
            if (index === -1) {
                return interaction.reply({ content: '⚠️ Role is not in whitelist.', flags: ['Ephemeral'] })
            }
            config.whitelistedRoles.splice(index, 1)
            await config.save()
            return interaction.reply(`✅ Removed ${role} from automod whitelist.`)
        }
    }

    private buildStatusEmbed(config: any, rules: any[], guildName: string, guildIcon: string | null): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor(config.enabled ? Colors.Green : Colors.Red)
            .setAuthor({ name: `${guildName} | Automod Status`, iconURL: guildIcon || undefined })
            .setTimestamp()

        const statusEmoji = config.enabled ? '🟢' : '🔴'
        let configInfo = `${statusEmoji} **Status:** ${config.enabled ? 'Enabled' : 'Disabled'}\n\n`

        configInfo += `**Mute Role:** ${config.muteRoleId ? `<@&${config.muteRoleId}>` : config.autoFindMuteRole ? 'Auto-detect' : 'Not set'}\n`
        configInfo += `**Logs:** Uses moderation logs (see \`setlogs\`)\n`
        configInfo += `**Whitelisted Channels:** ${config.whitelistedChannels.length > 0 ? config.whitelistedChannels.map((id: string) => `<#${id}>`).join(', ') : 'None'}\n`
        configInfo += `**Whitelisted Roles:** ${config.whitelistedRoles.length > 0 ? config.whitelistedRoles.map((id: string) => `<@&${id}>`).join(', ') : 'None'}\n\n`

        embed.addFields({ name: '⚙️ Configuration', value: configInfo })

        if (rules.length > 0) {
            let rulesInfo = ''
            for (const rule of rules) {
                const emoji = rule.enabled ? '✅' : '❌'
                const ruleType = this.formatRuleType(rule.type)
                rulesInfo += `${emoji} **${ruleType}** - ${rule.punishment}`
                if (rule.threshold) rulesInfo += ` (threshold: ${rule.threshold})`
                if (rule.warningsBeforeAction) rulesInfo += ` [${rule.warningsBeforeAction} warnings]`
                if (rule.duration) rulesInfo += ` (${ms(rule.duration)})`
                rulesInfo += '\n'
            }
            embed.addFields({ name: '📋 Rules', value: rulesInfo || 'No rules configured' })
        }

        return embed
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

    private async ensureConfig(guildId: string) {
        let config = await AutomodConfig.findOne({ guildId })
        if (!config) {
            await this.client.automod.initializeGuild(guildId)
            config = await AutomodConfig.findOne({ guildId })
        }
        return config!
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('automod')
                .setDescription('Configure and manage automoderation system')
                .addSubcommand((sub) =>
                    sub.setName('enable').setDescription('Enable automoderation for this server')
                )
                .addSubcommand((sub) =>
                    sub.setName('disable').setDescription('Disable automoderation for this server')
                )
                .addSubcommand((sub) =>
                    sub.setName('status').setDescription('View current automod configuration and rules')
                )
                .addSubcommand((sub) =>
                    sub.setName('muterole')
                        .setDescription('Set the mute role for automod punishments')
                        .addRoleOption((opt) => opt.setName('role').setDescription('The role to use for muting').setRequired(false))
                        .addBooleanOption((opt) => opt.setName('auto').setDescription('Automatically find mute role').setRequired(false))
                )
                .addSubcommand((sub) =>
                    sub.setName('whitelist')
                        .setDescription('Manage channel whitelist')
                        .addStringOption((opt) =>
                            opt.setName('action')
                                .setDescription('Action to perform')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Add', value: 'add' },
                                    { name: 'Remove', value: 'remove' }
                                )
                        )
                        .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to add/remove').setRequired(true))
                )
                .addSubcommand((sub) =>
                    sub.setName('whiterole')
                        .setDescription('Manage role whitelist')
                        .addStringOption((opt) =>
                            opt.setName('action')
                                .setDescription('Action to perform')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Add', value: 'add' },
                                    { name: 'Remove', value: 'remove' }
                                )
                        )
                        .addRoleOption((opt) => opt.setName('role').setDescription('Role to add/remove').setRequired(true))
                )
        )
    }
}
