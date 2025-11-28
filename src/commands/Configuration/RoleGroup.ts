import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, Role } from 'discord.js'

import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'rolegroup',
    aliases: ['rg', 'rolegroups'],
    description: 'Manage role groups for organized role assignment system',
    detailedDescription: 'Create and manage role groups that define how roles can be assigned together. Groups can have different modes: single (one role only), multiple (any number), or limited (min/max constraints).',
    examples: [
        { example: 'rg create colors single', description: 'Create a "colors" group where users can only have one color role.' },
        { example: 'rg create hobbies multiple', description: 'Create a "hobbies" group where users can have multiple hobby roles.' },
        { example: 'rg create teams limited --max 2', description: 'Create a "teams" group where users can have up to 2 team roles.' },
        { example: 'rg addrole colors @Red @Blue @Green', description: 'Add multiple roles to the "colors" group.' },
        { example: 'rg removerole colors @Red', description: 'Remove a specific role from the "colors" group.' },
        { example: 'rg settings colors --required @Verified --remove @Uncolored', description: 'Configure group to require @Verified role and remove @Uncolored when assigning.' },
        { example: 'rg emoji colors @Red', description: 'Set up emoji for Red role in colors group using reaction-based setup.' },
        { example: 'rg list', description: 'Show all role groups in this server.' },
        { example: 'rg info colors', description: 'Show detailed information about the \"colors\" group including rules and roles.' },
        { example: 'rg delete colors', description: 'Delete the entire "colors" group and all its roles.' }
    ],
    requiredUserPermissions: ['ManageRoles'],
    requiredClientPermissions: ['ManageRoles'],
    subcommands: [
        { name: 'create', chatInputRun: 'chatInputCreate', messageRun: 'messageCreate' },
        { name: 'delete', chatInputRun: 'chatInputDelete', messageRun: 'messageDelete' },
        { name: 'addrole', chatInputRun: 'chatInputAddRole', messageRun: 'messageAddRole' },
        { name: 'removerole', chatInputRun: 'chatInputRemoveRole', messageRun: 'messageRemoveRole' },
        { name: 'settings', chatInputRun: 'chatInputSettings', messageRun: 'messageSettings' },
        { name: 'info', chatInputRun: 'chatInputInfo', messageRun: 'messageInfo' },
        { name: 'emoji', chatInputRun: 'chatInputEmoji', messageRun: 'messageEmoji' },
        { name: 'list', chatInputRun: 'chatInputList', messageRun: 'messageList', default: true },
        { name: 'info', chatInputRun: 'chatInputInfo', messageRun: 'messageInfo' }
    ]
})
export class RoleGroupCommand extends Subcommand {
    client = this.container.client

    public async messageCreate(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const name = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const mode = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!name || !mode) {
            return message.channel.send('❌ Usage: `rg create <name> <mode>`\nModes: `single`, `multiple`, `limited`')
        }

        if (!['single', 'multiple', 'limited'].includes(mode)) {
            return message.channel.send('❌ Invalid mode. Use: `single`, `multiple`, or `limited`')
        }

        try {
            await this.client.roleGroups.createGroup(message.guild.id, {
                name,
                mode: mode as any
            })

            return message.channel.send(`✅ Created role group: **${name}** (${mode} mode)`)
        } catch (error: any) {
            if (error.code === 11000) {
                return message.channel.send(`❌ A role group named **${name}** already exists.`)
            }
            return message.channel.send('❌ Failed to create role group. Please try again.')
        }
    }

    public async messageDelete(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const name = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!name) {
            return message.channel.send('❌ Usage: `rg delete <name>`')
        }

        const deleted = await this.client.roleGroups.deleteGroup(message.guild.id, name)

        if (deleted) {
            return message.channel.send(`✅ Deleted role group: **${name}**`)
        } else {
            return message.channel.send(`❌ Role group **${name}** not found.`)
        }
    }

    public async messageAddRole(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const name = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!name) {
            return message.channel.send('❌ Usage: `rg addrole <group> @role1 @role2...`')
        }

        const roles: Role[] = []
        let role: Role | null

        while ((role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null))) {
            roles.push(role)
        }

        if (roles.length === 0) {
            return message.channel.send('❌ Please provide at least one role to add.')
        }

        const { client } = this.container

        try {
            const addedRoles = await client.roleGroups.addRolesToGroup(
                message.guild.id,
                name,
                roles.map(r => r.id)
            )

            const roleNames = roles.filter(r => addedRoles.some(ar => ar.roleId === r.id)).map(r => r.name)

            if (addedRoles.length === 0) {
                return message.channel.send('❌ All specified roles are already in this group.')
            }

            return message.channel.send(`✅ Added ${addedRoles.length} role(s) to **${name}**: ${roleNames.join(', ')}`)
        } catch (error: any) {
            if (error.message === 'Group not found') {
                return message.channel.send(`❌ Role group **${name}** not found.`)
            }
            return message.channel.send('❌ Failed to add roles. Please try again.')
        }
    }

    public async messageRemoveRole(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const name = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)

        if (!name || !role) {
            return message.channel.send('❌ Usage: `rg removerole <group> @role`')
        }

        const removed = await this.client.roleGroups.removeRoleFromGroup(message.guild.id, name, role.id)

        if (removed) {
            return message.channel.send(`✅ Removed **${role.name}** from group **${name}**`)
        } else {
            return message.channel.send(`❌ Role **${role.name}** not found in group **${name}**.`)
        }
    }

    public async messageList(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const groups = await this.client.roleGroups.getGroups(message.guild.id)

        if (groups.length === 0) {
            return message.channel.send('📝 No role groups configured in this server.')
        }

        const embed = new EmbedBuilder()
            .setTitle('🎭 Role Groups')
            .setColor(Colors.Blurple)
            .setFooter({ text: `${groups.length} role groups` })

        for (const group of groups.slice(0, 10)) {
            const groupRoles = await this.client.roleGroups.getGroupRoles(message.guild.id, group.name)
            const roleCount = groupRoles.length

            let modeText: string = group.mode
            if (group.mode === 'limited' && (group.minRoles || group.maxRoles)) {
                const min = group.minRoles || 0
                const max = group.maxRoles || '∞'
                modeText = `limited (${min}-${max})`
            }

            const statusText = group.enabled ? '✅' : '❌'

            embed.addFields([{
                name: `${statusText} ${group.name}`,
                value: `Mode: ${modeText} | Roles: ${roleCount}`,
                inline: true
            }])
        }

        if (groups.length > 10) {
            embed.setDescription(`Showing first 10 of ${groups.length} role groups.`)
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async messageInfo(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const name = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!name) {
            return message.channel.send('❌ Usage: `rg info <group>`')
        }

        const group = await this.client.roleGroups.getGroup(message.guild.id, name)

        if (!group) {
            return message.channel.send(`❌ Role group **${name}** not found.`)
        }

        const groupRoles = await this.client.roleGroups.getGroupRoles(message.guild.id, name)

        const embed = new EmbedBuilder()
            .setTitle(`🎭 Role Group: ${group.name}`)
            .setColor(Colors.Blurple)
            .addFields([
                { name: 'Mode', value: group.mode, inline: true },
                { name: 'Status', value: group.enabled ? 'Enabled' : 'Disabled', inline: true },
                { name: 'Roles', value: groupRoles.length.toString(), inline: true }
            ])

        if (group.mode === 'limited') {
            const min = group.minRoles || 0
            const max = group.maxRoles || 'No limit'
            embed.addFields([{ name: 'Limits', value: `Min: ${min}, Max: ${max}`, inline: true }])
        }

        if (groupRoles.length > 0) {
            const roleList = groupRoles.slice(0, 20).map(gr => {
                const role = message.guild!.roles.cache.get(gr.roleId)
                const roleName = role ? role.name : 'Deleted Role'
                const emojiText = gr.emoji ? `${gr.emoji} ` : ''
                return `${emojiText}${roleName}`
            })

            embed.addFields([{
                name: 'Roles in Group',
                value: roleList.join('\n') || 'None',
                inline: false
            }])

            if (groupRoles.length > 20) {
                embed.setFooter({ text: `Showing first 20 of ${groupRoles.length} roles` })
            }
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async messageSettings(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        return message.channel.send('🚧 Settings command coming soon! Use slash commands for now.')
    }

    public async messageEmoji(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const groupName = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const role = await args.pickResult('role').then(res => res.isOk() ? res.unwrap() : null)

        if (!groupName || !role) {
            return message.channel.send('❌ Usage: `rg emoji <group> @role`')
        }

        const group = await this.client.roleGroups.getGroup(message.guild.id, groupName)
        if (!group) {
            return message.channel.send(`❌ Role group **${groupName}** not found.`)
        }

        const groupRoles = await this.client.roleGroups.getGroupRoles(message.guild.id, groupName)
        const roleInGroup = groupRoles.find(gr => gr.roleId === role.id)
        if (!roleInGroup) {
            return message.channel.send(`❌ Role **${role.name}** is not in group **${groupName}**.`)
        }

        return await this.client.tasks.get('roleemojisetup')?.exec(message, groupName, role) || false
    }

    public async chatInputCreate(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const name = interaction.options.getString('name', true)
        const mode = interaction.options.getString('mode', true) as 'single' | 'multiple' | 'limited'
        const minRoles = interaction.options.getInteger('min') || undefined
        const maxRoles = interaction.options.getInteger('max') || undefined

        try {
            await this.client.roleGroups.createGroup(interaction.guild.id, {
                name,
                mode,
                minRoles,
                maxRoles
            })

            let modeText: string = mode
            if (mode === 'limited' && (minRoles || maxRoles)) {
                const min = minRoles || 0
                const max = maxRoles || '∞'
                modeText = `${mode} (${min}-${max})`
            }

            return interaction.reply({ content: `✅ Created role group: **${name}** (${modeText} mode)` })
        } catch (error: any) {
            if (error.code === 11000) {
                return interaction.reply({ content: `❌ A role group named **${name}** already exists.`, ephemeral: true })
            }
            return interaction.reply({ content: '❌ Failed to create role group. Please try again.', ephemeral: true })
        }
    }

    public async chatInputDelete(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const name = interaction.options.getString('name', true)

        const deleted = await this.client.roleGroups.deleteGroup(interaction.guild.id, name)

        if (deleted) {
            return interaction.reply({ content: `✅ Deleted role group: **${name}**` })
        } else {
            return interaction.reply({ content: `❌ Role group **${name}** not found.`, ephemeral: true })
        }
    }

    public async chatInputAddRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const name = interaction.options.getString('name', true)
        const role1 = interaction.options.getRole('role1', true) as Role
        const role2 = interaction.options.getRole('role2') as Role | null
        const role3 = interaction.options.getRole('role3') as Role | null
        const role4 = interaction.options.getRole('role4') as Role | null
        const role5 = interaction.options.getRole('role5') as Role | null

        const roles = [role1, role2, role3, role4, role5].filter(Boolean) as Role[]

        const { client } = this.container

        try {
            const addedRoles = await client.roleGroups.addRolesToGroup(
                interaction.guild.id,
                name,
                roles.map(r => r.id)
            )

            const roleNames = roles.filter(r => addedRoles.some(ar => ar.roleId === r.id)).map(r => r.name)

            if (addedRoles.length === 0) {
                return interaction.reply({ content: '❌ All specified roles are already in this group.', ephemeral: true })
            }

            return interaction.reply({ content: `✅ Added ${addedRoles.length} role(s) to **${name}**: ${roleNames.join(', ')}` })
        } catch (error: any) {
            if (error.message === 'Group not found') {
                return interaction.reply({ content: `❌ Role group **${name}** not found.`, ephemeral: true })
            }
            return interaction.reply({ content: '❌ Failed to add roles. Please try again.', ephemeral: true })
        }
    }

    public async chatInputRemoveRole(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const name = interaction.options.getString('name', true)
        const role = interaction.options.getRole('role', true) as Role

        const removed = await this.client.roleGroups.removeRoleFromGroup(interaction.guild.id, name, role.id)

        if (removed) {
            return interaction.reply({ content: `✅ Removed **${role.name}** from group **${name}**` })
        } else {
            return interaction.reply({ content: `❌ Role **${role.name}** not found in group **${name}**.`, ephemeral: true })
        }
    }

    public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.messageList(interaction as any)
    }

    public async chatInputInfo(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.messageInfo(interaction as any, { pickResult: () => ({ isOk: () => true, unwrap: () => interaction.options.getString('name', true) }) } as any)
    }

    public async chatInputSettings(interaction: Subcommand.ChatInputCommandInteraction) {
        return interaction.reply({ content: '🚧 Settings command coming soon!', ephemeral: true })
    }

    public async chatInputEmoji(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const groupName = interaction.options.getString('name', true)
        const role = interaction.options.getRole('role', true) as Role

        const group = await this.client.roleGroups.getGroup(interaction.guild.id, groupName)
        if (!group) {
            return interaction.reply({ content: `❌ Role group **${groupName}** not found.`, ephemeral: true })
        }

        const groupRoles = await this.client.roleGroups.getGroupRoles(interaction.guild.id, groupName)
        const roleInGroup = groupRoles.find(gr => gr.roleId === role.id)
        if (!roleInGroup) {
            return interaction.reply({ content: `❌ Role **${role.name}** is not in group **${groupName}**.`, ephemeral: true })
        }

        await interaction.reply({ content: '🎭 Setting up emoji for role... Check the channel for instructions!', ephemeral: true })

        return await this.client.tasks.get('roleemojisetup')?.exec(interaction as any, groupName, role) || false
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('rolegroup')
                .setDescription('Manage role groups')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('create')
                        .setDescription('Create a new role group')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('Group name')
                                .setRequired(true)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('mode')
                                .setDescription('Group mode')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Single (one role only)', value: 'single' },
                                    { name: 'Multiple (unlimited)', value: 'multiple' },
                                    { name: 'Limited (min/max)', value: 'limited' }
                                )
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('min')
                                .setDescription('Minimum roles (limited mode)')
                                .setMinValue(0)
                        )
                        .addIntegerOption((option) =>
                            option
                                .setName('max')
                                .setDescription('Maximum roles (limited mode)')
                                .setMinValue(1)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('delete')
                        .setDescription('Delete a role group')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('Group name')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('addrole')
                        .setDescription('Add roles to a group')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('Group name')
                                .setRequired(true)
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role1')
                                .setDescription('Role to add')
                                .setRequired(true)
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role2')
                                .setDescription('Additional role to add')
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role3')
                                .setDescription('Additional role to add')
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role4')
                                .setDescription('Additional role to add')
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role5')
                                .setDescription('Additional role to add')
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('removerole')
                        .setDescription('Remove a role from a group')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('Group name')
                                .setRequired(true)
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to remove')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('list')
                        .setDescription('List all role groups')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('info')
                        .setDescription('Get detailed info about a role group')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('Group name')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('settings')
                        .setDescription('Configure group settings (coming soon)')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('emoji')
                        .setDescription('Set emoji for a role using interactive setup')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('Group name')
                                .setRequired(true)
                        )
                        .addRoleOption((option) =>
                            option
                                .setName('role')
                                .setDescription('Role to set emoji for')
                                .setRequired(true)
                        )
                )
        )
    }
}