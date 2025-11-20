import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, Role } from 'discord.js'
import ms from 'ms'

import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'reactionroles',
    aliases: ['rr', 'reactionrole'],
    description: 'Configure interactive reaction-based role assignment system',
    detailedDescription: 'Advanced reaction role system enabling members to self-assign roles by reacting to messages. Supports temporary roles with auto-removal, unique role groups for exclusive selections, and comprehensive message management with cleanup utilities.',
    examples: [
        { example: 'rr setup 123456789 ⭐ @Member', description: 'Add basic reaction role - react with ⭐ to get @Member role.' },
        { example: 'rr setup 123456789 🎮 @Gamer permanent', description: 'Add permanent reaction role that persists until manually removed.' },
        { example: 'rr setup 123456789 ⏰ @VIP temporary 1h', description: 'Add temporary role that auto-removes after 1 hour (supports: m, h, d).' },
        { example: 'rr setup 123456789 🔴 @Red unique colors', description: 'Add to "colors" group - only one color role at a time.' },
        { example: 'rr setup 123456789 🟢 @Green unique colors', description: 'Another color in the same group - removes other colors when selected.' },
        { example: 'rr remove 123456789 ⭐', description: 'Remove specific reaction role from the message.' },
        { example: 'rr list', description: 'Display all reaction roles across the server with their configurations.' },
        { example: 'rr cleanup 123456789', description: 'Remove ALL reaction roles from a specific message.' },
        { example: 'rr toggle 123456789 ⭐ false', description: 'Temporarily disable reaction role without removing it.' }
    ],
    requiredUserPermissions: ['ManageRoles'],
    requiredClientPermissions: ['ManageRoles'],
    subcommands: [
        { name: 'setup', chatInputRun: 'chatInputSetup', messageRun: 'messageSetup' },
        { name: 'remove', chatInputRun: 'chatInputRemove', messageRun: 'messageRemove' },
        { name: 'list', chatInputRun: 'chatInputList', messageRun: 'messageList', default: true },
        { name: 'cleanup', chatInputRun: 'chatInputCleanup', messageRun: 'messageCleanup' },
        { name: 'toggle', chatInputRun: 'chatInputToggle', messageRun: 'messageToggle' }
    ]
})
export class ReactionRolesCommand extends Subcommand {
    public async messageSetup(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const messageId = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const emoji = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)

        if (!messageId || !emoji || !role) return message.channel.send({ content: '❌ Missing required arguments.\nExample: `rr setup 123456789 ⭐ @Member`' })

        const typeArg = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : 'normal')
        let type = 'normal'
        let groupId: string | undefined
        let temporaryDuration: number | undefined

        if (['normal', 'unique', 'verify', 'temporary'].includes(typeArg)) {
            type = typeArg

            if (type === 'unique') {
                const group = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

                if (group) groupId = group
            } else if (type === 'temporary') {
                const durationArg = await args.pickResult('string')
                if (durationArg.ok) {
                    try {
                        const parsed = ms(durationArg.unwrap() as any)
                        temporaryDuration = typeof parsed === 'number' ? parsed : undefined
                        if (!temporaryDuration || temporaryDuration < ms('1m')) {
                            return message.channel.send('❌ Temporary duration must be at least 1 minute.\nExample: `1h`, `30m`, `2d`')
                        }
                    } catch {
                        return message.channel.send('❌ Invalid duration format.\nExample: `1h`, `30m`, `2d`')
                    }
                }
            }
        }

        let targetMessage: Message
        try {
            targetMessage = await message.channel.messages.fetch(messageId)
        } catch {
            return message.channel.send('❌ Could not find message with that ID in this channel.')
        }

        const { client } = this.container

        try {
            await client.reactionRoles.setupReactionRole(message.guild.id, {
                messageId,
                channelId: message.channel.id,
                emoji,
                roleId: role.id,
                type: type as any,
                groupId,
                temporaryDuration
            })

            await targetMessage.react(emoji)

            const typeText = type === 'temporary' && temporaryDuration ?
                ` (${type} - ${ms(temporaryDuration, { long: true })})` :
                type !== 'normal' ? ` (${type}${groupId ? ` - ${groupId}` : ''})` : ''

            return message.channel.send(`✅ Reaction role setup: ${emoji} → ${role}${typeText}`)
        } catch (error: any) {
            if (error.code === 11000) {
                return message.channel.send('❌ A reaction role already exists for that message and emoji combination.')
            }
            return message.channel.send('❌ Failed to setup reaction role. Please try again.')
        }
    }

    public async messageRemove(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const messageIdArg = await args.pickResult('string')
        if (!messageIdArg.ok) return message.channel.send('❌ Please provide a message ID.\nExample: `rr remove 123456789 ⭐`')

        const emojiArg = await args.pickResult('string')
        if (!emojiArg.ok) return message.channel.send('❌ Please provide an emoji.\nExample: `rr remove 123456789 ⭐`')

        const { client } = this.container
        const removed = await client.reactionRoles.removeReactionRole(
            message.guild.id,
            messageIdArg.unwrap(),
            emojiArg.unwrap()
        )

        if (removed) return message.channel.send(`✅ Removed reaction role: ${emojiArg.unwrap()}`)
        else return message.channel.send(`❌ No reaction role found for that message and emoji combination.`)
    }

    public async messageList(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const { client } = this.container
        const reactionRoles = await client.reactionRoles.getReactionRoles(message.guild.id)

        if (reactionRoles.length === 0) {
            return message.channel.send('📝 No reaction roles configured in this server.')
        }

        const embed = new EmbedBuilder()
            .setTitle('🎭 Reaction Roles')
            .setColor(Colors.Blurple)
            .setFooter({ text: `${reactionRoles.length} reaction roles` })

        for (const reactionRole of reactionRoles.slice(0, 10)) {
            const role = message.guild.roles.cache.get(reactionRole.roleId)
            const roleText = role ? role.toString() : 'Deleted Role'

            const typeText = reactionRole.type !== 'normal' ? ` (${reactionRole.type})` : ''
            const groupText = reactionRole.groupId ? ` - Group: ${reactionRole.groupId}` : ''
            const usageText = reactionRole.maxUses ? ` - Uses: ${reactionRole.currentUses}/${reactionRole.maxUses}` : ''
            const statusText = reactionRole.enabled ? '✅' : '❌'

            embed.addFields([{
                name: `${statusText} ${reactionRole.emoji} → ${roleText}`,
                value: `Message: ${reactionRole.messageId}${typeText}${groupText}${usageText}`,
                inline: false
            }])
        }

        if (reactionRoles.length > 10) {
            embed.setDescription(`Showing first 10 of ${reactionRoles.length} reaction roles.`)
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async messageCleanup(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const messageId = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!messageId) return message.channel.send('❌ Please provide a message ID.\nExample: `rr cleanup 123456789`')

        const { client } = this.container
        const removed = await client.reactionRoles.cleanupMessage(messageId)

        return message.channel.send(`🧹 Removed ${removed} reaction roles from message.`)
    }

    public async messageToggle(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const messageId = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const emoji = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const action = await args.pickResult('enum', { enum: ['enable', 'disable'] }).then(res => res.isOk() ? res.unwrap() : null)

        if (!messageId || !emoji || !action) return message.channel.send('❌ Please provide an emoji.\nExample: `rr toggle 123456789 ⭐ enable`')

        const { client } = this.container
        const success = await client.reactionRoles.toggleReactionRole(
            message.guild.id,
            messageId,
            emoji,
            action === 'enable'
        )

        if (success) return message.channel.send(`✅ Reaction role ${action}d: ${emoji}`)
        else return message.channel.send(`❌ No reaction role found for that message and emoji combination.`)
    }

    public async chatInputSetup(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const messageId = interaction.options.getString('message', true)
        const emoji = interaction.options.getString('emoji', true)
        const role = interaction.options.getRole('role', true) as Role
        const type = interaction.options.getString('type') || 'normal'
        const group = interaction.options.getString('group')
        const duration = interaction.options.getString('duration')

        let temporaryDuration: number | undefined
        if (type === 'temporary' && duration) {
            try {
                const parsed = ms(duration as any)
                temporaryDuration = typeof parsed === 'number' ? parsed : undefined
                if (!temporaryDuration || temporaryDuration < 60000) {
                    return interaction.reply({ content: '❌ Temporary duration must be at least 1 minute.', flags: ['Ephemeral'] })
                }
            } catch {
                return interaction.reply({ content: '❌ Invalid duration format. Use formats like: 1h, 30m, 2d', flags: ['Ephemeral'] })
            }
        }

        const { client } = this.container

        try {
            await client.reactionRoles.setupReactionRole(interaction.guild.id, {
                messageId,
                channelId: interaction.channel!.id,
                emoji,
                roleId: role.id,
                type: type as any,
                groupId: group || undefined,
                temporaryDuration
            })

            const typeText = type === 'temporary' && temporaryDuration ?
                ` (${type} - ${ms(temporaryDuration, { long: true })})` :
                type !== 'normal' ? ` (${type}${group ? ` - ${group}` : ''})` : ''

            return interaction.reply({ content: `✅ Reaction role setup: ${emoji} → ${role}${typeText}` })
        } catch (error: any) {
            if (error.code === 11000) {
                return interaction.reply({ content: '❌ A reaction role already exists for that message and emoji combination.', flags: ['Ephemeral'] })
            }
            return interaction.reply({ content: '❌ Failed to setup reaction role. Please try again.', flags: ['Ephemeral'] })
        }
    }

    public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const messageId = interaction.options.getString('message', true)
        const emoji = interaction.options.getString('emoji', true)

        const { client } = this.container
        const removed = await client.reactionRoles.removeReactionRole(interaction.guild.id, messageId, emoji)

        if (removed) {
            return interaction.reply({ content: `✅ Removed reaction role: ${emoji}` })
        } else {
            return interaction.reply({ content: '❌ No reaction role found for that message and emoji combination.', flags: ['Ephemeral'] })
        }
    }

    public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const { client } = this.container
        const reactionRoles = await client.reactionRoles.getReactionRoles(interaction.guild.id)

        if (reactionRoles.length === 0) {
            return interaction.reply({ content: '📝 No reaction roles configured in this server.', flags: ['Ephemeral'] })
        }

        const embed = new EmbedBuilder()
            .setTitle('🎭 Reaction Roles')
            .setColor(Colors.Blurple)
            .setFooter({ text: `${reactionRoles.length} reaction roles` })

        for (const reactionRole of reactionRoles.slice(0, 10)) {
            const role = interaction.guild.roles.cache.get(reactionRole.roleId)
            const roleText = role ? role.toString() : 'Deleted Role'

            const typeText = reactionRole.type !== 'normal' ? ` (${reactionRole.type})` : ''
            const groupText = reactionRole.groupId ? ` - Group: ${reactionRole.groupId}` : ''
            const usageText = reactionRole.maxUses ? ` - Uses: ${reactionRole.currentUses}/${reactionRole.maxUses}` : ''
            const statusText = reactionRole.enabled ? '✅' : '❌'

            embed.addFields([{
                name: `${statusText} ${reactionRole.emoji} → ${roleText}`,
                value: `Message: ${reactionRole.messageId}${typeText}${groupText}${usageText}`,
                inline: false
            }])
        }

        if (reactionRoles.length > 10) {
            embed.setDescription(`Showing first 10 of ${reactionRoles.length} reaction roles.`)
        }

        return interaction.reply({ embeds: [embed] })
    }

    public async chatInputCleanup(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const messageId = interaction.options.getString('message', true)

        const { client } = this.container
        const removed = await client.reactionRoles.cleanupMessage(messageId)

        return interaction.reply({ content: `🧹 Removed ${removed} reaction roles from message.` })
    }

    public async chatInputToggle(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const messageId = interaction.options.getString('message', true)
        const emoji = interaction.options.getString('emoji', true)
        const enabled = interaction.options.getBoolean('enabled', true)

        const { client } = this.container
        const success = await client.reactionRoles.toggleReactionRole(interaction.guild.id, messageId, emoji, enabled)

        if (success) {
            const action = enabled ? 'enabled' : 'disabled'
            return interaction.reply({ content: `✅ Reaction role ${action}: ${emoji}` })
        } else {
            return interaction.reply({ content: '❌ No reaction role found for that message and emoji combination.', ephemeral: true })
        }
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('reactionroles')
                .setDescription('Configure reaction role system')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('setup')
                        .setDescription('Add a reaction role to a message')
                        .addStringOption((option) =>
                            option
                                .setName('message')
                                .setDescription('Message ID')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('emoji')
                                .setDescription('Emoji to react with')
                                .setRequired(true)
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to assign')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('type')
                                .setDescription('Type of reaction role')
                                .setChoices(
                                    { name: 'Normal', value: 'normal' },
                                    { name: 'Unique (One per group)', value: 'unique' },
                                    { name: 'Verify (Keep role)', value: 'verify' },
                                    { name: 'Temporary', value: 'temporary' }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('group')
                                .setDescription('Group name for unique roles')
                                .setRequired(false)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('duration')
                                .setDescription('Duration for temporary roles (e.g., 1h, 30m)')
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove a reaction role')
                        .addStringOption((option) =>
                            option
                                .setName('message')
                                .setDescription('Message ID')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('emoji')
                                .setDescription('Emoji')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('list')
                        .setDescription('List all reaction roles')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('cleanup')
                        .setDescription('Remove all reaction roles from a message')
                        .addStringOption((option) =>
                            option
                                .setName('message')
                                .setDescription('Message ID')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('toggle')
                        .setDescription('Enable or disable a reaction role')
                        .addStringOption((option) =>
                            option
                                .setName('message')
                                .setDescription('Message ID')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('emoji')
                                .setDescription('Emoji')
                                .setRequired(true)
                        )
                        .addBooleanOption((option) =>
                            option
                                .setName('enabled')
                                .setDescription('Enable or disable')
                                .setRequired(true)
                        )
                )
        )
    }
}