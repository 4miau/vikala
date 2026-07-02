import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'
import { createAnimalEmbed } from '../../lib/util/embedBuilders'

@ApplyOptions<Command.Options>({
	name: 'cat',
	aliases: ['kitty', 'meow'],
	description: 'Returns a random cat picture.',
	detailedDescription: 'Fetches a random cat picture from The Cat API.',
	usage: 'cat',
	examples: [{ example: 'cat', description: 'Will return a random cat picture' }]
})
export class Cat extends Command {
	private client = this.container.client

	public async messageRun(message: Message) {
		if (!message.channel.isSendable()) return

		return this.handleCatPicture((content) => (message.channel as TextChannel).send(content))
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		return this.handleCatPicture((content) => interaction.reply(content))
	}

	private async handleCatPicture(sendFn: (content: any) => Promise<any>) {
		try {
			const response: CatApiResponse[] = await this.client.tasks.get('getcatpicture').exec()

			if (!response || response.length === 0) {
				return sendFn({ content: 'No cat pictures found. Please try again later.' })
			}

			const cat = response[0]
			const embed = createAnimalEmbed('🐱 Random Cat', cat.url, Colors.CatRed)

			return sendFn({ embeds: [embed] })
		} catch {
			return sendFn({ content: 'Failed to fetch cat picture. Please try again later.' })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('cat').setDescription('Returns a random cat picture.'))
	}
}
