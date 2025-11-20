import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, User } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'level',
    aliases: ['lvl', 'xp', 'rank'],
    description: 'View and manage leveling system',
    detailedDescription: 'Check levels, manage XP, configure role rewards, and view leaderboards.',
    usage: 'level <check|add|remove|set|rewards|leaderboard|config> [options]',
    examples: [
        { example: 'level', description: 'Check your current level and XP.' },
        { example: 'level check @user', description: 'Check another user\'s level.' },
        { example: 'level add @user 100', description: 'Add 100 XP to a user.' },
        { example: 'level remove @user 50', description: 'Remove 50 XP from a user.' },
        { example: 'level set @user 10', description: 'Set a user to level 10.' },
        { example: 'level leaderboard', description: 'View the server leaderboard.' },
        { example: 'level rewards add 5 @role', description: 'Add a role reward at level 5.' },
        { example: 'level config', description: 'View current leveling configuration.' },
        { example: 'level config xp 10 30', description: 'Set XP per message to 10-30.' },
        { example: 'level config cooldown 30', description: 'Set XP cooldown to 30 seconds.' },
        { example: 'level config channel #levels', description: 'Set dedicated level-up channel.' }
    ],
    subcommands: [
        { name: 'check', chatInputRun: 'chatInputCheck', messageRun: 'messageCheck', default: true },
        { name: 'add', chatInputRun: 'chatInputAdd', messageRun: 'messageAdd' },
        { name: 'remove', chatInputRun: 'chatInputRemove', messageRun: 'messageRemove' },
        { name: 'set', chatInputRun: 'chatInputSet', messageRun: 'messageSet' },
        { name: 'leaderboard', chatInputRun: 'chatInputLeaderboard', messageRun: 'messageLeaderboard' },
        { name: 'rewards', chatInputRun: 'chatInputRewards', messageRun: 'messageRewards' },
        { name: 'config', chatInputRun: 'chatInputConfig', messageRun: 'messageConfig' },
        { name: 'reset', chatInputRun: 'chatInputReset', messageRun: 'messageReset' }
    ]
})
export class LevelCommand extends Subcommand {
    client = this.container.client

    public async messageCheck(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const user = await args.pickResult('user').then(res => res.isOk() ? res.unwrap() : message.author)
        const userLevel = await this.client.leveling.getUserLevel(user.id, message.guild.id)

        if (!userLevel) return message.channel.send(`${user.username} hasn't gained any XP yet!`)

        const embed = await this.createLevelEmbed(user, userLevel)
        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputCheck(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const user = interaction.options.getUser('user') || interaction.user
        const userLevel = await this.client.leveling.getUserLevel(user.id, interaction.guild.id)

        if (!userLevel) {
            return interaction.reply({ content: `${user.username} hasn't gained any XP yet!`, flags: ['Ephemeral'] })
        }

        const embed = await this.createLevelEmbed(user, userLevel)
        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageAdd(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        const user = await args.pickResult('user').then(res => res.isOk() ? res.unwrap() : null)
        const amount = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() : null)

        if (!user || !amount || amount <= 0) {
            return message.channel.send('Usage: `level add <user> <amount>`')
        }

        const result = await this.client.leveling.addXP(user.id, message.guild.id, amount)

        let response = `✅ Added **${result.xpGained}** XP to ${user.username}.`
        if (result.leveledUp) {
            response += ` They leveled up to **Level ${result.newLevel}**! 🎉`
        }

        return message.channel.send(response)
    }

    public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {

        const user = interaction.options.getUser('user', true)
        const amount = interaction.options.getNumber('amount', true)

        if (amount <= 0) {
            return interaction.reply({ content: '❌ Amount must be positive.', flags: ['Ephemeral'] })
        }

        const result = await this.client.leveling.addXP(user.id, interaction.guild.id, amount)

        let response = `✅ Added **${result.xpGained}** XP to ${user.username}.`
        if (result.leveledUp) {
            response += ` They leveled up to **Level ${result.newLevel}**! 🎉`
        }

        return interaction.reply({ content: response, flags: ['Ephemeral'] })
    }

    public async messageRemove(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        const user = await args.pickResult('user').then(res => res.isOk() ? res.unwrap() : null)
        const amount = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() : null)

        if (!user || !amount || amount <= 0) {
            return message.channel.send('Usage: `level remove <user> <amount>`')
        }

        const result = await this.client.leveling.removeXP(user.id, message.guild.id, amount)

        let response = `✅ Removed **${result.xpRemoved}** XP from ${user.username}.`
        if (result.levelDecreased) {
            response += ` Their level decreased to **Level ${result.newLevel}**.`
        }

        return message.channel.send(response)
    }

    public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', flags: ['Ephemeral'] })
        }

        const user = interaction.options.getUser('user', true)
        const amount = interaction.options.getNumber('amount', true)

        if (amount <= 0) {
            return interaction.reply({ content: '❌ Amount must be positive.', flags: ['Ephemeral'] })
        }

        const result = await this.client.leveling.removeXP(user.id, interaction.guild.id, amount)

        let response = `✅ Removed **${result.xpRemoved}** XP from ${user.username}.`
        if (result.levelDecreased) {
            response += ` Their level decreased to **Level ${result.newLevel}**.`
        }

        return interaction.reply({ content: response, flags: ['Ephemeral'] })
    }

    public async messageLeaderboard(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const leaderboard = await this.client.leveling.getLeaderboard(message.guild.id, 10)

        if (leaderboard.length === 0) {
            return message.channel.send('No users have gained XP yet!')
        }

        const embed = await this.createLeaderboardEmbed(leaderboard)
        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputLeaderboard(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const leaderboard = await this.client.leveling.getLeaderboard(interaction.guild.id, 10)

        if (leaderboard.length === 0) {
            return interaction.reply({ content: 'No users have gained XP yet!', flags: ['Ephemeral'] })
        }

        const embed = await this.createLeaderboardEmbed(leaderboard)
        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    private async createLevelEmbed(user: User, userLevel: any): Promise<EmbedBuilder> {
        const nextLevelXP = Math.pow((userLevel.level + 1) / 0.1, 2)
        const currentLevelXP = Math.pow(userLevel.level / 0.1, 2)
        const progressXP = userLevel.totalXp - currentLevelXP
        const totalNeededForNext = nextLevelXP - currentLevelXP

        const progressPercentage = Math.floor((progressXP / totalNeededForNext) * 100)
        const progressBar = this.createProgressBar(progressPercentage)

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${user.username}'s Level`)
            .setThumbnail(user.displayAvatarURL())
            .setColor(Colors.BlueViolet)
            .addFields(
                { name: 'Level', value: userLevel.level.toString(), inline: true },
                { name: 'Total XP', value: userLevel.totalXp.toLocaleString(), inline: true },
                { name: 'Messages Sent', value: userLevel.messageCount.toLocaleString(), inline: true },
                { name: 'Progress to Next Level', value: `${progressBar}\n${progressXP.toLocaleString()}/${totalNeededForNext.toLocaleString()} XP (${progressPercentage}%)`, inline: false }
            )
            .setTimestamp()

        return embed
    }

    private async createLeaderboardEmbed(leaderboard: any[]): Promise<EmbedBuilder> {
        const embed = new EmbedBuilder()
            .setTitle('🏆 Level Leaderboard')
            .setColor(Colors.Golden)
            .setTimestamp()

        const description = await Promise.all(leaderboard.map(async (entry, index) => {
            const user = await this.client.users.fetch(entry.userId).catch(() => null)
            const username = user ? user.username : 'Unknown User'
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`

            return `${medal} **${username}** - Level ${entry.level} (${entry.totalXp.toLocaleString()} XP)`
        }))

        embed.setDescription(description.join('\n'))
        return embed
    }

    private createProgressBar(percentage: number, length: number = 20): string {
        const filled = Math.floor((percentage / 100) * length)
        const empty = length - filled
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
    }

    public async messageConfig(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        const action = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!action) {
            const config = this.client.settings.get(message.guild.id, 'leveling', {})
            const embed = new EmbedBuilder()
                .setTitle('📋 Leveling Configuration')
                .setColor(Colors.Blurple)
                .addFields([
                    { name: 'XP Per Message', value: `${config.xpPerMessage?.min || 15}-${config.xpPerMessage?.max || 25}`, inline: true },
                    { name: 'Cooldown', value: `${Math.floor((config.xpCooldown || 60000) / 1000)}s`, inline: true },
                    { name: 'Level Up Channel', value: config.levelUpChannel ? `<#${config.levelUpChannel}>` : 'Same channel', inline: true },
                    { name: 'Enabled Channels', value: config.enabledChannels?.length ? config.enabledChannels.map((id: string) => `<#${id}>`).join(', ') : 'All channels', inline: false },
                    { name: 'Disabled Channels', value: config.disabledChannels?.length ? config.disabledChannels.map((id: string) => `<#${id}>`).join(', ') : 'None', inline: false },
                    { name: 'Role Multipliers', value: config.multiplierRoles && Object.keys(config.multiplierRoles).length
                        ? Object.entries(config.multiplierRoles).map(([roleId, mult]) => `<@&${roleId}>: ${mult}x`).join(', ')
                        : 'None', inline: false }
                ])
                .setFooter({ text: 'Use "level config <setting> <value>" to modify settings' })

            return message.channel.send({ embeds: [embed] })
        }

        switch (action.toLowerCase()) {
            case 'xp':
            case 'xprate':
                const min = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() : null)
                const max = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() : null)

                if (!min || !max || min < 1 || max < min) {
                    return message.channel.send('❌ Please provide valid min and max XP values. Usage: `level config xp <min> <max>`')
                }

                await this.client.settings.set(message.guild.id, 'leveling.xpPerMessage', { min, max })
                return message.channel.send(`✅ XP per message set to ${min}-${max}`)

            case 'cooldown':
                const seconds = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() : null)

                if (!seconds || seconds < 1 || seconds > 3600) {
                    return message.channel.send('❌ Please provide a valid cooldown in seconds (1-3600). Usage: `level config cooldown <seconds>`')
                }

                await this.client.settings.set(message.guild.id, 'leveling.xpCooldown', seconds * 1000)
                return message.channel.send(`✅ XP cooldown set to ${seconds} seconds`)

            case 'channel':
            case 'levelupchannel':
                const channel = await args.pickResult('guildTextChannel').then(res => res.isOk() ? res.unwrap() : null)

                if (!channel) {
                    await this.client.settings.set(message.guild.id, 'leveling.levelUpChannel', null)
                    return message.channel.send('✅ Level up messages will now be sent in the same channel as the user message')
                }

                await this.client.settings.set(message.guild.id, 'leveling.levelUpChannel', channel.id)
                return message.channel.send(`✅ Level up messages will now be sent to ${channel}`)

            case 'enable':
            case 'enablechannel':
                const enableChannel = await args.pickResult('guildTextChannel').then(res => res.isOk() ? res.unwrap() : null)

                if (!enableChannel) {
                    return message.channel.send('❌ Please specify a channel. Usage: `level config enable #channel`')
                }

                const currentEnabled = this.client.settings.get(message.guild.id, 'leveling.enabledChannels', [])
                if (!currentEnabled.includes(enableChannel.id)) {
                    currentEnabled.push(enableChannel.id)
                    await this.client.settings.set(message.guild.id, 'leveling.enabledChannels', currentEnabled)
                    return message.channel.send(`✅ XP gain enabled in ${enableChannel}`)
                }
                return message.channel.send(`❌ XP gain is already enabled in ${enableChannel}`)

            case 'disable':
            case 'disablechannel':
                const disableChannel = await args.pickResult('guildTextChannel').then(res => res.isOk() ? res.unwrap() : null)

                if (!disableChannel) {
                    return message.channel.send('❌ Please specify a channel. Usage: `level config disable #channel`')
                }

                const currentDisabled = this.client.settings.get(message.guild.id, 'leveling.disabledChannels', [])
                if (!currentDisabled.includes(disableChannel.id)) {
                    currentDisabled.push(disableChannel.id)
                    await this.client.settings.set(message.guild.id, 'leveling.disabledChannels', currentDisabled)
                    return message.channel.send(`✅ XP gain disabled in ${disableChannel}`)
                }
                return message.channel.send(`❌ XP gain is already disabled in ${disableChannel}`)

            default:
                return message.channel.send('❌ Invalid config option. Available: `xp`, `cooldown`, `channel`, `enable`, `disable`')
        }
    }

    public async chatInputConfig(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', ephemeral: true })
        }


        const config = this.client.settings.get(interaction.guild.id, 'leveling', {})

        const embed = new EmbedBuilder()
            .setTitle('📋 Leveling Configuration')
            .setColor(Colors.Blurple)
            .addFields([
                { name: 'XP Per Message', value: `${config.xpPerMessage?.min || 15}-${config.xpPerMessage?.max || 25}`, inline: true },
                { name: 'Cooldown', value: `${Math.floor((config.xpCooldown || 60000) / 1000)}s`, inline: true },
                { name: 'Level Up Channel', value: config.levelUpChannel ? `<#${config.levelUpChannel}>` : 'Same channel', inline: true },
                { name: 'Enabled Channels', value: config.enabledChannels?.length ? config.enabledChannels.map((id: string) => `<#${id}>`).join(', ') : 'All channels', inline: false },
                { name: 'Disabled Channels', value: config.disabledChannels?.length ? config.disabledChannels.map((id: string) => `<#${id}>`).join(', ') : 'None', inline: false },
                { name: 'Role Multipliers', value: config.multiplierRoles && Object.keys(config.multiplierRoles).length
                    ? Object.entries(config.multiplierRoles).map(([roleId, mult]) => `<@&${roleId}>: ${mult}x`).join(', ')
                    : 'None', inline: false }
            ])
            .setFooter({ text: 'Use message commands to modify settings: "level config <setting> <value>"' })

        return interaction.reply({ embeds: [embed], ephemeral: true })
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('level')
                .setDescription('Level system commands')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('check')
                        .setDescription('Check a user\'s level and XP')
                        .addUserOption((option) =>
                            option
                                .setName('user')
                                .setDescription('The user to check (defaults to you)')
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Add XP to a user (Manage Server required)')
                        .addUserOption((option) =>
                            option
                                .setName('user')
                                .setDescription('The user to add XP to')
                                .setRequired(true)
                        )
                        .addNumberOption((option) =>
                            option
                                .setName('amount')
                                .setDescription('Amount of XP to add')
                                .setRequired(true)
                                .setMinValue(1)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove XP from a user (Manage Server required)')
                        .addUserOption((option) =>
                            option
                                .setName('user')
                                .setDescription('The user to remove XP from')
                                .setRequired(true)
                        )
                        .addNumberOption((option) =>
                            option
                                .setName('amount')
                                .setDescription('Amount of XP to remove')
                                .setRequired(true)
                                .setMinValue(1)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('leaderboard')
                        .setDescription('View the server leaderboard')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('config')
                        .setDescription('View leveling configuration (Manage Server required)')
                )
        )
    }
}