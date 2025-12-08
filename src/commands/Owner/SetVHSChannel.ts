import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ChannelType, type Message, type TextChannel } from 'discord.js'

@ApplyOptions<Command.Options>({
    name: 'setvhschannel',
    aliases: ['setvhs'],
    description: 'Set the VHS channel',
    usage: 'setvhschannel <channel>',
    examples: [
        { example: 'setvhschannel #vhs-updates', description: 'Sets the VHS channel to #vhs-updates.' }
    ],
    preconditions: ['OwnerOnly'],
    runIn: ['GUILD_ANY']
})
export class SetVHSChannel extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const channel = await args.pickResult('sendablechannel').then(res => res.isOk() ? res.unwrap() as TextChannel : null)
        if (!channel) return message.channel.send({ content: 'Please provide a valid sendable channel.' })

        this.client.settings.set('global', 'vhsChannel', channel.id)
        return message.channel.send({ content: 'VHS Channel has been set.' })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum])
        this.client.settings.set('global', 'vhsChannel', channel.id)

        return interaction.reply({ content: 'VHS Channel has been set.', flags: ['Ephemeral'] })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('setvhschannel')
                .setDescription('Set the VHS channel')
                .addChannelOption((option) =>
                    option
                        .setName('channel')
                        .setDescription('The channel to set as the VHS channel')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread)
                )
        )
    }
}