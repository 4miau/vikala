import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
    name: 'fox',
    aliases: ['foxxy'],
    description: 'Returns a random fox picture.',
    detailedDescription: 'Fetches a random fox picture from RandomFox API.',
    usage: 'fox',
    examples: [
        { example: 'fox', description: 'Will return a random fox picture' }
    ]
})
export class Fox extends Command {
    client = this.container.client

    public async messageRun(message: Message) {
        if (!message.channel.isSendable()) return

        return this.handleFoxPicture((content) => (message.channel as TextChannel).send(content))
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        return this.handleFoxPicture((content) => interaction.reply(content))
    }

    private async handleFoxPicture(sendFn: (content: any) => Promise<any>) {
        try {
            const response: FoxApiResponse = await this.client.tasks.get('getfoxpicture').exec()

            if (!response || !response.image) {
                return sendFn({ content: 'No fox pictures found. Please try again later.' })
            }

            const embed = new EmbedBuilder()
                .setTitle('🦊 Random Fox')
                .setImage(response.image)
                .setColor(Colors.FoxOrange)

            return sendFn({ embeds: [embed] })
        } catch {
            return sendFn({ content: 'Failed to fetch fox picture. Please try again later.' })
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('fox')
                .setDescription('Returns a random fox picture.')
        )
    }
}