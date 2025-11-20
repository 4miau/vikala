import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message, TextChannel } from 'discord.js'
import { Subcommand } from '@sapphire/plugin-subcommands'

@ApplyOptions<Subcommand.Options>({
    name: 'prefix',
    description: 'Gets/sets the current server prefix.',
    subcommands: [
        { name: 'default', messageRun: 'prefixMsg', chatInputRun: 'prefixInput', default: true },
        { name: 'setprefix', messageRun: 'prefixMsgSet', chatInputRun: 'prefixInputSet', requiredUserPermissions: ['Administrator'] }
    ],
    usage: 'prefix [newPrefix]',
    examples: [
        { example: 'prefix', description: "Returns the server's current prefix." },
        { example: 'prefix setprefix !', description: "Sets the server's prefix to '!'." }
    ]
})
export class Prefix extends Subcommand {
    client = this.container.client

    public async prefixMsg(message: Message) {
        if (!message.channel.isSendable()) return
        if (!message.inGuild()) return message.channel.send({ content: `\`${this.client.options.fetchPrefix(message).toString()}\`` })

        return this.handleGetPrefix(message.guild, (content) => message.channel.send(content))
    }

    public async prefixInput(interaction: Subcommand.ChatInputCommandInteraction) {
        return this.handleGetPrefix(interaction.guild, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
    }

    public async prefixMsgSet(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const newPrefix: string = await args.restResult('string').then(res => res.isOk ? res.unwrap() : null)
        if (!newPrefix) return message.channel.send({ content: 'Please provide a new prefix to set.' })

        return this.handleSetPrefix(message.guild, newPrefix, (content) => (message.channel as TextChannel).send(content))
    }

    public async prefixInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
        const newPrefix = interaction.options.getString('prefix', true)

        return this.handleSetPrefix(interaction.guild, newPrefix, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
    }

    private handleGetPrefix(guild: any, sendFn: (content: any) => Promise<any>) {
        const prefix = this.client.settings.get(guild, 'prefix', this.client.options.defaultPrefix)
        return sendFn({ content: `The server's current prefix is \`${prefix}\`.` })
    }

    private handleSetPrefix(guild: any, newPrefix: string, sendFn: (content: any) => Promise<any>) {
        this.client.settings.set(guild, 'prefix', newPrefix)
        return sendFn({ content: `Server prefix updated to: \`${newPrefix}\`.` })
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('prefix')
                .setDescription('Gets/sets the current server prefix.')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('default')
                        .setDescription("Gets the server's current prefix.")
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('setprefix')
                        .setDescription("Sets the server's prefix.")
                        .addStringOption((option) =>
                            option
                                .setName('prefix')
                                .setDescription('The new prefix to set for the server.')
                                .setRequired(true)
                )
            )
        )
    }
}