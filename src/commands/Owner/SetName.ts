import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
    name: 'setname',
    aliases: [],
    description: 'Sets the name for the bot.',
    usage: 'setname <name>',
    examples: [
        { example: 'setname vikky', description: 'Sets the bot\'s name to "vikky".' }
    ],
    preconditions: ['OwnerOnly']
})
export class SetName extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const name = (await args.restResult('string').then(res => res.isOk ? res.unwrap() : null)).trim()
        if (!name) return message.channel.send({ content: 'You must provide a name to set for the bot.' })

        try {
            await this.client.user.setUsername(name.slice(0, 32))
            return message.channel.send({ content: `Successfully updated my name to **${name}**!` })
        } catch {
            return message.channel.send({ content: 'Name update failed.' })
        }
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const name = interaction.options.getString('name', true).trim()

        try {
            await this.client.user.setUsername(name.slice(0, 32))
            return interaction.reply({ content: `Successfully updated my name to **${name}**!`, flags: ['Ephemeral'] })
        } catch {
            return interaction.reply({ content: 'Name update failed.', flags: ['Ephemeral'] })
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('setname')
                .setDescription('Sets the name for the bot.')
        )
    }
}