import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, Role } from 'discord.js'
import ms from 'ms'

import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'autoroles',
    aliases: ['autorole', 'ar'],
    description: 'Configure automatic role assignment system for new members',
    detailedDescription: 'Comprehensive automatic role management system that assigns roles based on member join events, server boosts, or time-based delays. Supports priorities, conditional assignments, and flexible rule management for streamlined server moderation.',
    requiredUserPermissions: ['ManageRoles'],
    requiredClientPermissions: ['ManageRoles'],
    examples: [
        { example: 'autoroles list', description: 'Display all configured autorole rules with their status and settings.' },
        { example: 'autoroles add join @Member', description: 'Automatically assign @Member role when users join the server.' },
        { example: 'autoroles add join @Verified 5m', description: 'Assign @Verified role 5 minutes after joining (supports: s, m, h, d).' },
        { example: 'autoroles add time @Trusted 24h', description: 'Assign @Trusted role after 24 hours of membership.' },
        { example: 'autoroles add boost @Booster', description: 'Assign @Booster role when members boost the server.' },
        { example: 'autoroles remove @Member', description: 'Remove the autorole rule for @Member role.' },
        { example: 'autoroles toggle @Member false', description: 'Temporarily disable autorole rule without deleting it.' },
        { example: 'autoroles priority @VIP 10', description: 'Set priority level (higher numbers = higher priority).' }
    ],
    subcommands: [
        { name: 'list', chatInputRun: 'chatInputList', messageRun: 'messageList', default: true },
        { name: 'add', chatInputRun: 'chatInputAdd', messageRun: 'messageAdd' },
        { name: 'remove', chatInputRun: 'chatInputRemove', messageRun: 'messageRemove' },
        { name: 'toggle', chatInputRun: 'chatInputToggle', messageRun: 'messageToggle' },
        { name: 'priority', chatInputRun: 'chatInputPriority', messageRun: 'messagePriority' }
    ]
})
export class AutorolesCommand extends Subcommand {
    private client = this.container.client

    public async messageList(message: Message) {
        if (!message.channel.isSendable()) return


        const rules = await this.client.autoroles.getRules(message.guild.id)

        if (rules.length === 0) {
            return message.channel.send('❌ No autorole rules configured for this server.')
        }

        const embed = new EmbedBuilder()
            .setTitle('🤖 Autorole Rules')
            .setColor(Colors.Blurple)
            .setDescription(`Found ${rules.length} autorole rule(s)`)

        for (const rule of rules.slice(0, 10)) {
            const role = message.guild.roles.cache.get(rule.roleId)
            const roleName = role ? role.name : `Unknown Role (${rule.roleId})`
            const status = rule.enabled ? '✅' : '❌'
            const delay = rule.delay > 0 ? ` (${ms(rule.delay, { long: true })})` : ''

            embed.addFields([{
                name: `${status} ${roleName}`,
                value: `**Type:** ${rule.type}${delay}\n**Priority:** ${rule.priority}`,
                inline: true
            }])
        }

        if (rules.length > 10) {
            embed.setFooter({ text: `Showing first 10 of ${rules.length} rules` })
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
        const rules = await this.client.autoroles.getRules(interaction.guild.id)

        if (rules.length === 0) return interaction.reply({ content: '❌ No autorole rules configured for this server.', flags: ['Ephemeral'] })

        const embed = new EmbedBuilder()
            .setTitle('🤖 Autorole Rules')
            .setColor(Colors.Blurple)
            .setDescription(`Found ${rules.length} autorole rule(s)`)

        for (const rule of rules.slice(0, 10)) {
            const role = interaction.guild.roles.cache.get(rule.roleId)
            const roleName = role ? role.name : `Unknown Role (${rule.roleId})`
            const status = rule.enabled ? '✅' : '❌'
            const delay = rule.delay > 0 ? ` (${ms(rule.delay, { long: true })})` : ''

            embed.addFields([{
                name: `${status} ${roleName}`,
                value: `**Type:** ${rule.type}${delay}\n**Priority:** ${rule.priority}`,
                inline: true
            }])
        }

        if (rules.length > 10) embed.setFooter({ text: `Showing first 10 of ${rules.length} rules` })

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageAdd(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const type = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)

        if (!type || !['join', 'time', 'boost'].includes(type.toLowerCase())) return message.channel.send('❌ Please specify a valid type: `join`, `time`, or `boost`\nExample: `autoroles add join @Member`')
        if (!role) return message.channel.send('❌ Please mention a valid role.\nExample: `autoroles add join @Member`')

        let delay = 0
        const delayArg = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (delayArg) {
            try {
                const parsedDelay = ms(delayArg as any)
                if (typeof parsedDelay === 'number') delay = parsedDelay
            } catch {
            }
        }

        try {
            await this.client.autoroles.addRule(message.guild.id, type.toLowerCase() as any, role.id, { delay })
            const delayText = delay > 0 ? ` with ${ms(delay, { long: true })} delay` : ''
            return message.channel.send(`✅ Added ${type} autorole for ${role}${delayText}`)
        } catch (error: any) {
            if (error.code === 11000) return message.channel.send('❌ An autorole rule already exists for that role.')
            return message.channel.send('❌ Failed to add autorole rule. Please try again.')
        }
    }

    public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
        const type = interaction.options.getString('type', true) as 'join' | 'time' | 'boost'
        const role = interaction.options.getRole('role', true) as Role
        const delay = interaction.options.getString('delay') || '0'

        let delayMs = 0
        if (delay !== '0') {
            try {
                const parsed = ms(delay as any)
                delayMs = typeof parsed === 'number' ? parsed : 0
                if (delayMs === 0) return interaction.reply({ content: '❌ Invalid delay format. Use formats like: 5m, 1h, 30s', flags: ['Ephemeral'] })
            } catch {
                return interaction.reply({ content: '❌ Invalid delay format. Use formats like: 5m, 1h, 30s', flags: ['Ephemeral'] })
            }
        }

        try {
            await this.client.autoroles.addRule(interaction.guild.id, type, role.id, { delay: delayMs })
            const delayText = delayMs > 0 ? ` with ${ms(delayMs, { long: true })} delay` : ''
            return interaction.reply({ content: `✅ Added ${type} autorole for ${role}${delayText}`, flags: ['Ephemeral'] })
        } catch (error: any) {
            if (error.code === 11000) return interaction.reply({ content: '❌ An autorole rule already exists for that role.', flags: ['Ephemeral'] })
            return interaction.reply({ content: '❌ Failed to add autorole rule. Please try again.', flags: ['Ephemeral'] })
        }
    }

    public async messageRemove(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)
        if (!role) return message.channel.send('❌ Please mention a valid role.\nExample: `autoroles remove @Member`')

        const removed = await this.client.autoroles.removeRule(message.guild.id, role.id)

        if (removed) return message.channel.send(`✅ Removed autorole rule for ${role}`)
        return message.channel.send(`❌ No autorole rule found for ${role}`)
    }

    public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
        const role = interaction.options.getRole('role', true)
        const removed = await this.client.autoroles.removeRule(interaction.guild.id, role.id)

        if (removed) return interaction.reply({ content: `✅ Removed autorole rule for ${role}`, flags: ['Ephemeral'] })
        return interaction.reply({ content: `❌ No autorole rule found for ${role}`, flags: ['Ephemeral'] })
    }

    public async messageToggle(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)
        const enabled = await args.pickResult('boolean').then(res => res.isOk() ? res.unwrap() : null)

        if (!role) return message.channel.send('❌ Please mention a valid role.\nExample: `autoroles toggle @Member false`')
        if (enabled === null) return message.channel.send('❌ Please specify true or false.\nExample: `autoroles toggle @Member false`')


        const updated = await this.client.autoroles.toggleRule(message.guild.id, role.id, enabled)
        const status = enabled ? 'enabled' : 'disabled'

        if (updated) return message.channel.send(`✅ ${status.charAt(0).toUpperCase() + status.slice(1)} autorole rule for ${role}`)
        return message.channel.send(`❌ No autorole rule found for ${role}`)
    }

    public async chatInputToggle(interaction: Subcommand.ChatInputCommandInteraction) {
        const role = interaction.options.getRole('role', true) as Role
        const enabled = interaction.options.getBoolean('enabled', true)
        const updated = await this.client.autoroles.toggleRule(interaction.guild.id, role.id, enabled)

        const status = enabled ? 'enabled' : 'disabled'

        if (updated) return interaction.reply({ content: `✅ ${status.charAt(0).toUpperCase() + status.slice(1)} autorole rule for ${role}`, flags: ['Ephemeral'] })
        return interaction.reply({ content: `❌ No autorole rule found for ${role}`, flags: ['Ephemeral'] })
    }

    public async messagePriority(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)
        const priority = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() : null)

        if (!role) return message.channel.send('❌ Please mention a valid role.\nExample: `autoroles priority @Member 10`')
        if (priority === null) return message.channel.send('❌ Please specify a priority number.\nExample: `autoroles priority @Member 10`')

        const updated = await this.client.autoroles.updateRulePriority(message.guild.id, role.id, priority)

        if (updated) return message.channel.send(`✅ Updated priority for ${role} to ${priority}`)
        return message.channel.send(`❌ No autorole rule found for ${role}`)
    }

    public async chatInputPriority(interaction: Subcommand.ChatInputCommandInteraction) {
        const role = interaction.options.getRole('role', true) as Role
        const priority = interaction.options.getInteger('priority', true)
        const updated = await this.client.autoroles.updateRulePriority(interaction.guild.id, role.id, priority)

        if (updated) return interaction.reply({ content: `✅ Updated priority for ${role} to ${priority}`, flags: ['Ephemeral'] })
        return interaction.reply({ content: `❌ No autorole rule found for ${role}`, flags: ['Ephemeral'] })
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('autoroles')
                .setDescription('Configure automatic role assignment')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('list')
                        .setDescription('View all autorole rules')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Add an autorole rule (Manage Roles required)')
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Type of autorole')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Join Server', value: 'join' },
                                    { name: 'Server Boost', value: 'boost' }
                                )
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to assign automatically')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('delay')
                                .setDescription('Delay before assignment (e.g., 5m, 1h, 30s)')
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove an autorole rule (Manage Roles required)')
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to remove autorole for')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('toggle')
                        .setDescription('Enable or disable an autorole rule (Manage Roles required)')
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to toggle autorole for')
                                .setRequired(true)
                        )
                        .addBooleanOption((option) =>
                            option
                                .setName('enabled')
                                .setDescription('Enable or disable the rule')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('priority')
                        .setDescription('Set priority for an autorole rule (Manage Roles required)')
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to set priority for')
                                .setRequired(true)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('priority')
                                .setDescription('Priority number (higher = more priority)')
                                .setRequired(true)
                        )
                )
        )
    }
}