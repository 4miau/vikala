import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, TextChannel } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'goodbye',
    aliases: ['farewell', 'leave'],
    description: 'Configure farewell messages when members leave the server',
    detailedDescription: 'Customizable goodbye message system that announces member departures with personalized messages using dynamic placeholders. Helps maintain community awareness of membership changes and provides closure for member departures.',
    examples: [
        { example: 'goodbye config', description: 'Display current goodbye system configuration and active channel.' },
        { example: 'goodbye channel #general', description: 'Set goodbye messages to appear in the general channel.' },
        { example: 'goodbye channel #departures', description: 'Use a dedicated departures/goodbye channel for member exits.' },
        { example: 'goodbye enable', description: 'Enable goodbye message system for member departures.' },
    ],
    subcommands: [
        { name: 'config', chatInputRun: 'chatInputConfig', messageRun: 'messageConfig', default: true },
        { name: 'set', chatInputRun: 'chatInputSet', messageRun: 'messageSet' },
        { name: 'channel', chatInputRun: 'chatInputChannel', messageRun: 'messageChannel' },
        { name: 'disable', chatInputRun: 'chatInputDisable', messageRun: 'messageDisable' },
        { name: 'enable', chatInputRun: 'chatInputEnable', messageRun: 'messageEnable' }
    ],
    runIn: 'GUILD_TEXT'
})
export class GoodbyeCommand extends Subcommand {
    client = this.container.client

    public async messageConfig(message: Message) {
        if (!message.channel.isSendable()) return

        const config = await this.client.welcome.getGoodbyeConfig(message.guild.id)

        const embed = new EmbedBuilder()
            .setTitle('👋 Goodbye Configuration')
            .setColor(Colors.Red)
            .addFields([
                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Channel', value: config.channel ? `<#${config.channel}>` : 'Not set', inline: true },
                { name: 'Message', value: config.message || 'Not set', inline: false }
            ])
            .setFooter({ text: 'Variables: {user} {username} {guild} {memberCount}' })

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputConfig(interaction: Subcommand.ChatInputCommandInteraction) {
        const config = await this.client.welcome.getGoodbyeConfig(interaction.guild.id)

        const embed = new EmbedBuilder()
            .setTitle('👋 Goodbye Configuration')
            .setColor(Colors.Red)
            .addFields([
                { name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Channel', value: config.channel ? `<#${config.channel}>` : 'Not set', inline: true },
                { name: 'Message', value: config.message || 'Not set', inline: false }
            ])
            .setFooter({ text: 'Variables: {user} {username} {guild} {memberCount}' })

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageSet(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        const goodbyeMessage = await args.restResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!goodbyeMessage) {
            return message.channel.send('❌ Please provide a goodbye message.\nExample: `goodbye set {username} has left {guild}`')
        }

        await this.client.welcome.setGoodbyeMessage(message.guild.id, goodbyeMessage)
        await this.client.welcome.setGoodbyeEnabled(message.guild.id, true)

        return message.channel.send(`✅ Goodbye message set to: ${goodbyeMessage}`)
    }

    public async chatInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', flags: ['Ephemeral'] })
        }

        const goodbyeMessage = interaction.options.getString('message', true)
        await this.client.welcome.setGoodbyeMessage(interaction.guild.id, goodbyeMessage)
        await this.client.welcome.setGoodbyeEnabled(interaction.guild.id, true)

        return interaction.reply({ content: `✅ Goodbye message set to: ${goodbyeMessage}`, flags: ['Ephemeral'] })
    }

    public async messageChannel(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        const channel = await args.pickResult('guildTextChannel').then(res => res.isOk() ? res.unwrap() : null)

        if (!channel) {
            return message.channel.send('❌ Please mention a valid text channel.\nExample: `goodbye channel #general`')
        }

        await this.client.welcome.setGoodbyeChannel(message.guild.id, channel.id)
        return message.channel.send(`✅ Goodbye channel set to ${channel}`)
    }

    public async chatInputChannel(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', flags: ['Ephemeral'] })
        }

        const channel = interaction.options.getChannel('channel', true) as TextChannel

        await this.client.welcome.setGoodbyeChannel(interaction.guild.id, channel.id)

        return interaction.reply({ content: `✅ Goodbye channel set to ${channel}`, flags: ['Ephemeral'] })
    }

    public async messageDisable(message: Message) {
        if (!message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        await this.client.welcome.setGoodbyeEnabled(message.guild.id, false)

        return message.channel.send('✅ Goodbye system disabled')
    }

    public async chatInputDisable(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', flags: ['Ephemeral'] })
        }

        await this.client.welcome.setGoodbyeEnabled(interaction.guild.id, false)

        return interaction.reply({ content: '✅ Goodbye system disabled', flags: ['Ephemeral'] })
    }

    public async messageEnable(message: Message) {
        if (!message.channel.isSendable()) return
        if (!message.member?.permissions.has('ManageGuild')) {
            return message.channel.send('❌ You need the Manage Server permission to use this command.')
        }

        await this.client.welcome.setGoodbyeEnabled(message.guild.id, true)

        return message.channel.send('✅ Goodbye system enabled')
    }

    public async chatInputEnable(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', flags: ['Ephemeral'] })
        }

        await this.client.welcome.setGoodbyeEnabled(interaction.guild.id, true)

        return interaction.reply({ content: '✅ Goodbye system enabled', flags: ['Ephemeral'] })
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('goodbye')
                .setDescription('Configure goodbye messages and settings')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('config')
                        .setDescription('View current goodbye configuration')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('set')
                        .setDescription('Set goodbye message (Manage Server required)')
                        .addStringOption((option) =>
                            option
                                .setName('message')
                                .setDescription('Goodbye message with variables: {user} {username} {guild} {memberCount}')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('channel')
                        .setDescription('Set goodbye channel (Manage Server required)')
                        .addChannelOption((option) =>
                            option
                                .setName('channel')
                                .setDescription('Channel to send goodbye messages')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('enable')
                        .setDescription('Enable goodbye system (Manage Server required)')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('disable')
                        .setDescription('Disable goodbye system (Manage Server required)')
                )
        )
    }
}