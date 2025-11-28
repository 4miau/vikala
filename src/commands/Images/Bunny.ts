import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
    name: 'bunny',
    aliases: ['rabbit', 'bun'],
    description: 'Returns a random bunny GIF.',
    detailedDescription: 'Fetches a random bunny GIF from Bunnies.io API.',
    usage: 'bunny',
    examples: [
        { example: 'bunny', description: 'Will return a random bunny GIF' }
    ]
})
export class Bunny extends Command {
    client = this.container.client

    public async messageRun(message: Message) {
        if (!message.channel.isSendable()) return

        return this.handleBunnyPicture((content) => (message.channel as TextChannel).send(content))
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.handleBunnyPicture((content) => interaction.reply(content))
    }

    private async handleBunnyPicture(sendFn: (content: any) => Promise<any>) {
        try {
            const response: BunnyApiResponse = await this.client.tasks.get('getbunnypicture').exec()

            if (!response || !response.media || !response.media.gif) {
                return sendFn({ content: 'No bunny pictures found. Please try again later.' })
            }

            const embed = new EmbedBuilder()
                .setTitle('🐰 Random Bunny')
                .setImage(response.media.gif)
                .setColor(Colors.BunnyPink)

            return sendFn({ embeds: [embed] })
        } catch {
            return sendFn({ content: 'Failed to fetch bunny picture. Please try again later.' })
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('bunny')
                .setDescription('Returns a random bunny GIF.')
        )
    }
}