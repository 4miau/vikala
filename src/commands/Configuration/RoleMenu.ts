import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message } from 'discord.js'

import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'rolemenu',
    aliases: ['rm'],
    description: 'Create and manage interactive role menus for role assignment',
    detailedDescription: 'Create interactive menus where users can react with emojis to get roles. Uses an interactive setup process to assign emojis to roles.',
    examples: [
        { example: 'rm create colors', description: 'Create a role menu for the colors group in the current channel.' },
        { example: 'rm create colors #role-menu', description: 'Create a role menu for the colors group in a specific channel.' },
        { example: 'rm create hobbies 1234567890', description: 'Add role menu to an existing message by ID.' },
        { example: 'rm update 1234567890 --nodm', description: 'Toggle DM notifications for role menu message.' },
        { example: 'rm update 1234567890 --rr', description: 'Toggle role removal restriction for role menu message.' },
        { example: 'rm update 1234567890 --nodm --rr', description: 'Toggle both DM and role removal settings.' },
        { example: 'rm edit colors --add-emoji @Red', description: 'Set up emoji for Red role using reaction-based setup.' },
        { example: 'rm edit colors --remove-emoji 🔴', description: 'Remove the red circle emoji from the colors menu.' },
        { example: 'rm list', description: 'Show all active role menus in this server.' },
        { example: 'rm delete colors', description: 'Delete the role menu for the colors group.' },
        { example: 'rm refresh colors', description: 'Update the role menu message to reflect current roles.' }
    ],
    requiredUserPermissions: ['ManageRoles'],
    requiredClientPermissions: ['ManageRoles', 'AddReactions'],
    subcommands: [
        { name: 'create', chatInputRun: 'chatInputCreate', messageRun: 'messageCreate' },
        { name: 'edit', chatInputRun: 'chatInputEdit', messageRun: 'messageEdit' },
        { name: 'delete', chatInputRun: 'chatInputDelete', messageRun: 'messageDelete' },
        { name: 'refresh', chatInputRun: 'chatInputRefresh', messageRun: 'messageRefresh' },
        { name: 'update', chatInputRun: 'chatInputUpdate', messageRun: 'messageUpdate' },
        { name: 'list', chatInputRun: 'chatInputList', messageRun: 'messageList', default: true }
    ]
})
export class RoleMenuCommand extends Subcommand {
    client = this.container.client
    public async messageCreate(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const groupName = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!groupName) {
            return message.channel.send('❌ Usage: `rm create <group> [#channel | messageId]`')
        }

        const remaining = args.getOption('remaining') || ''
        const channelMatch = remaining.match(/<#(\d+)>/)
        const messageIdMatch = remaining.match(/(\d{17,19})/)

        let targetChannel: any = null
        let targetMessageId: string | undefined

        if (channelMatch) {
            targetChannel = message.guild.channels.cache.get(channelMatch[1])
            if (!targetChannel || !targetChannel.isTextBased()) {
                return message.channel.send('❌ Invalid channel or channel is not text-based.')
            }
        } else if (messageIdMatch) {
            targetMessageId = messageIdMatch[1]
        }

        return await this.client.tasks.get('rolemenuwizard')?.exec(
            message,
            groupName,
            targetChannel,
            targetMessageId
        ) || false
    }

    public async messageEdit(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const groupName = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!groupName) {
            return message.channel.send('❌ Usage: `rm edit <group> --add-emoji @role` or `rm edit <group> --remove-emoji <emoji>`')
        }

        const menu = await this.client.roleGroups.getMenu(message.guild.id, groupName)
        if (!menu) {
            return message.channel.send(`❌ No role menu found for group **${groupName}**.`)
        }

        const remaining = args.getOption('remaining') || ''

        const addEmojiMatch = remaining.match(/--add-emoji\s+<@&(\d+)>/)
        if (addEmojiMatch) {
            const [, roleId] = addEmojiMatch
            const role = message.guild.roles.cache.get(roleId)

            if (!role) {
                return message.channel.send('❌ Role not found.')
            }

            const success = await this.client.tasks.get('roleemojisetup')?.exec(message, groupName, role)

            if (success) {
                try {
                    const channel = message.guild.channels.cache.get(menu.channelId)
                    if (channel?.isTextBased()) {
                        const menuMessage = await channel.messages.fetch(menu.messageId)
                        const groupRoles = await this.client.roleGroups.getGroupRoles(message.guild.id, groupName)
                        const updatedRole = groupRoles.find(gr => gr.roleId === roleId)
                        if (updatedRole?.emoji) await menuMessage.react(updatedRole.emoji)
                    }
                } catch {
                }
            }

            return
        }

        const removeEmojiMatch = remaining.match(/--remove-emoji\s+(\S+)/)
        if (removeEmojiMatch) {
            const [, emoji] = removeEmojiMatch

            try {
                const removed = await this.client.roleGroups.removeRoleEmoji(message.guild.id, groupName, emoji)

                if (removed) {
                    try {
                        const channel = message.guild.channels.cache.get(menu.channelId)
                        if (channel?.isTextBased()) {
                            const menuMessage = await channel.messages.fetch(menu.messageId)
                            const reaction = menuMessage.reactions.cache.find(r =>
                                r.emoji.toString() === emoji || r.emoji.name === emoji
                            )
                            if (reaction) {
                                await reaction.users.remove(this.client.user!)
                            }
                        }
                    } catch {
                    }

                    return message.channel.send(`✅ Removed emoji ${emoji} from the menu.`)
                } else {
                    return message.channel.send(`❌ Emoji ${emoji} not found in this menu.`)
                }
            } catch (error) {
                return message.channel.send(`❌ Failed to remove emoji.`)
            }
        }

        return message.channel.send('❌ Usage: `rm edit <group> --add-emoji @role` or `rm edit <group> --remove-emoji <emoji>`')
    }

    public async messageDelete(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const groupName = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!groupName) {
            return message.channel.send('❌ Usage: `rm delete <group>`')
        }

        const deleted = await this.client.roleGroups.deleteMenu(message.guild.id, groupName)

        if (deleted) {
            return message.channel.send(`✅ Deleted role menu for group **${groupName}**.`)
        } else {
            return message.channel.send(`❌ No role menu found for group **${groupName}**.`)
        }
    }

    public async messageRefresh(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const groupName = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!groupName) {
            return message.channel.send('❌ Usage: `rm refresh <group>`')
        }

        const menu = await this.client.roleGroups.getMenu(message.guild.id, groupName)
        if (!menu) {
            return message.channel.send(`❌ No role menu found for group **${groupName}**.`)
        }

        const groupRoles = await this.client.roleGroups.getGroupRoles(message.guild.id, groupName)

        try {
            const channel = message.guild.channels.cache.get(menu.channelId)
            if (!channel?.isTextBased()) {
                return message.channel.send(`❌ Menu channel not found or not accessible.`)
            }

            const menuMessage = await channel.messages.fetch(menu.messageId)

            const embed = new EmbedBuilder()
                .setTitle(menu.title)
                .setDescription(menu.description)
                .setColor(Colors.Blurple)

            const rolesList = groupRoles.map(gr => {
                const role = message.guild!.roles.cache.get(gr.roleId)
                const roleName = role ? role.name : 'Deleted Role'
                const emojiText = gr.emoji ? `${gr.emoji} ` : '❓ '
                return `${emojiText}${roleName}`
            }).join('\n')

            embed.addFields([{
                name: 'Available Roles',
                value: rolesList || 'None configured',
                inline: false
            }])

            await menuMessage.edit({ embeds: [embed] })

            await menuMessage.reactions.removeAll()

            for (const groupRole of groupRoles) {
                if (groupRole.emoji) {
                    try {
                        await menuMessage.react(groupRole.emoji)
                    } catch {
                    }
                }
            }

            return message.channel.send(`✅ Refreshed role menu for **${groupName}** group.`)

        } catch{
            return message.channel.send(`❌ Failed to refresh menu. The message may have been deleted.`)
        }
    }

    public async messageUpdate(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const messageId = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!messageId) {
            return message.channel.send('❌ Usage: `rm update <messageId> [--nodm] [--rr]`')
        }

        const remaining = args.getOption('remaining') || ''
        const nodmFlag = remaining.includes('--nodm')
        const rrFlag = remaining.includes('--rr')

        if (!nodmFlag && !rrFlag) {
            return message.channel.send('❌ Please specify at least one flag: `--nodm` or `--rr`')
        }

        const menu = await this.client.roleGroups.getMenuByMessageId(message.guild.id, messageId)
        if (!menu) {
            return message.channel.send(`❌ No role menu found with message ID \`${messageId}\`.`)
        }

        try {
            const updates: any = {}
            const statusMessages: string[] = []

            if (nodmFlag) {
                updates.disableDMs = !menu.disableDMs
                const status = updates.disableDMs ? 'true' : 'false'
                statusMessages.push(`-nodm: ${status}`)
            }

            if (rrFlag) {
                updates.allowRoleRemoval = !menu.allowRoleRemoval
                const status = updates.allowRoleRemoval ? 'true' : 'false'
                statusMessages.push(`-rr: ${status}`)
            }

            await this.client.roleGroups.updateMenuFlags(message.guild.id, menu.groupName, updates)

            return message.channel.send(`✅ Updated **${menu.groupName}** role menu settings:\n${statusMessages.join('\n')}`)
        } catch {
            return message.channel.send('❌ Failed to update menu settings.')
        }
    }

    public async messageList(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const menus = await this.client.roleGroups.getMenus(message.guild.id)

        if (menus.length === 0) {
            return message.channel.send('📝 No role menus configured in this server.')
        }

        const embed = new EmbedBuilder()
            .setTitle('🎭 Role Menus')
            .setColor(Colors.Blurple)
            .setFooter({ text: `${menus.length} role menus` })

        for (const menu of menus.slice(0, 10)) {
            const channel = message.guild.channels.cache.get(menu.channelId)
            const channelName = channel ? `#${channel.name}` : 'Unknown Channel'

            embed.addFields([{
                name: menu.groupName,
                value: `Channel: ${channelName}\nMessage ID: \`${menu.messageId}\``,
                inline: true
            }])
        }

        if (menus.length > 10) {
            embed.setDescription(`Showing first 10 of ${menus.length} role menus.`)
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputCreate(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const groupName = interaction.options.getString('group', true)
        const title = interaction.options.getString('title') || `${groupName} Roles`
        const description = interaction.options.getString('description') || `React to get roles from the ${groupName} group.`
        const messageId = interaction.options.getString('message')

        const group = await this.client.roleGroups.getGroup(interaction.guild.id, groupName)
        if (!group) {
            return interaction.reply({ content: `❌ Role group **${groupName}** not found.`, ephemeral: true })
        }

        const groupRoles = await this.client.roleGroups.getGroupRoles(interaction.guild.id, groupName)
        if (groupRoles.length === 0) {
            return interaction.reply({ content: `❌ Role group **${groupName}** has no roles. Add roles first with \`/rolegroup addrole\`.`, ephemeral: true })
        }

        try {
            let targetMessage: Message

            if (messageId && interaction.channel?.isTextBased()) {
                try {
                    targetMessage = await interaction.channel.messages.fetch(messageId)
                } catch {
                    return interaction.reply({ content: `❌ Could not find message with ID \`${messageId}\`.`, ephemeral: true })
                }
            } else if (interaction.channel?.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(Colors.Blurple)

                const rolesList = groupRoles.map(gr => {
                    const role = interaction.guild!.roles.cache.get(gr.roleId)
                    const roleName = role ? role.name : 'Deleted Role'
                    const emojiText = gr.emoji ? `${gr.emoji} ` : '❓ '
                    return `${emojiText}${roleName}`
                }).join('\n')

                embed.addFields([{
                    name: 'Available Roles',
                    value: rolesList || 'None configured',
                    inline: false
                }])

                targetMessage = await interaction.channel.send({ embeds: [embed] })
            } else {
                return interaction.reply({ content: '❌ Cannot create menu in this channel type.', ephemeral: true })
            }

            await this.client.roleGroups.createMenu(interaction.guild.id, {
                groupName,
                channelId: interaction.channel!.id,
                messageId: targetMessage.id,
                title,
                description
            })

            for (const groupRole of groupRoles) {
                if (groupRole.emoji) {
                    try {
                        await targetMessage.react(groupRole.emoji)
                    } catch {
                        // Reaction failed, continue
                    }
                }
            }

            const actionText = messageId ? 'Updated existing message' : 'Created new message'
            return interaction.reply({ content: `✅ ${actionText} with role menu for **${groupName}** group.` })

        } catch (error: any) {
            if (error.code === 11000) {
                return interaction.reply({ content: `❌ A role menu for group **${groupName}** already exists.`, ephemeral: true })
            }
            return interaction.reply({ content: '❌ Failed to create role menu. Please try again.', ephemeral: true })
        }
    }

    public async chatInputEdit(interaction: Subcommand.ChatInputCommandInteraction) {
        return interaction.reply({ content: '🚧 Edit command coming soon! Use message commands for now.', ephemeral: true })
    }

    public async chatInputDelete(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const groupName = interaction.options.getString('group', true)

        const deleted = await this.client.roleGroups.deleteMenu(interaction.guild.id, groupName)

        if (deleted) {
            return interaction.reply({ content: `✅ Deleted role menu for group **${groupName}**.` })
        } else {
            return interaction.reply({ content: `❌ No role menu found for group **${groupName}**.`, ephemeral: true })
        }
    }

    public async chatInputRefresh(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.messageRefresh(interaction as any, { pickResult: () => ({ isOk: () => true, unwrap: () => interaction.options.getString('group', true) }) } as any)
    }

    public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.messageList(interaction as any)
    }

    public async chatInputUpdate(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const messageId = interaction.options.getString('messageid', true)
        const nodm = interaction.options.getBoolean('nodm')
        const rr = interaction.options.getBoolean('rr')

        if (nodm === null && rr === null) {
            return interaction.reply({ content: '❌ Please specify at least one flag to update.', ephemeral: true })
        }

        const menu = await this.client.roleGroups.getMenuByMessageId(interaction.guild.id, messageId)
        if (!menu) {
            return interaction.reply({ content: `❌ No role menu found with message ID \`${messageId}\`.`, ephemeral: true })
        }

        try {
            const updates: any = {}
            const statusMessages: string[] = []

            if (nodm !== null) {
                updates.disableDMs = nodm
                const status = nodm ? 'true' : 'false'
                statusMessages.push(`-nodm: ${status}`)
            }

            if (rr !== null) {
                updates.allowRoleRemoval = !rr
                const status = rr ? 'false' : 'true'
                statusMessages.push(`-rr: ${status}`)
            }

            await this.client.roleGroups.updateMenuFlags(interaction.guild.id, menu.groupName, updates)

            return interaction.reply({ content: `✅ Updated **${menu.groupName}** role menu settings:\n${statusMessages.join('\n')}` })
        } catch {
            return interaction.reply({ content: '❌ Failed to update menu settings.', ephemeral: true })
        }
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('rolemenu')
                .setDescription('Manage interactive role menus')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('create')
                        .setDescription('Create a role menu for a group')
                        .addStringOption((option) =>
                            option
                                .setName('group')
                                .setDescription('Role group name')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('title')
                                .setDescription('Menu title')
                        )
                        .addStringOption((option) =>
                            option
                                .setName('description')
                                .setDescription('Menu description')
                        )
                        .addStringOption((option) =>
                            option
                                .setName('message')
                                .setDescription('Existing message ID to use')
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('edit')
                        .setDescription('Edit a role menu (coming soon)')
                        .addStringOption((option) =>
                            option
                                .setName('group')
                                .setDescription('Role group name')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('delete')
                        .setDescription('Delete a role menu')
                        .addStringOption((option) =>
                            option
                                .setName('group')
                                .setDescription('Role group name')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('refresh')
                        .setDescription('Refresh/update a role menu')
                        .addStringOption((option) =>
                            option
                                .setName('group')
                                .setDescription('Role group name')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('update')
                        .setDescription('Update role menu settings')
                        .addStringOption((option) =>
                            option
                                .setName('messageid')
                                .setDescription('Message ID of the role menu to update')
                                .setRequired(true)
                        )
                        .addBooleanOption((option) =>
                            option
                                .setName('nodm')
                                .setDescription('Enable/disable DM notifications (true = disable DMs)')
                        )
                        .addBooleanOption((option) =>
                            option
                                .setName('rr')
                                .setDescription('Enable/disable role removal restriction (true = disable removal)')
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('list')
                        .setDescription('List all role menus')
                )
        )
    }
}