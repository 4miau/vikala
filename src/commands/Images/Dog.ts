import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'
import { createAnimalEmbed } from '../../lib/util/embedBuilders'

@ApplyOptions<Command.Options>({
	name: 'dog',
	aliases: ['doggy', 'woof', 'puppy'],
	description: 'Returns a random dog picture.',
	detailedDescription: 'Fetches a random dog picture from the Dog CEO API.',
	usage: 'dog',
	examples: [{ example: 'dog', description: 'Will return a random dog picture' }]
})
export class Dog extends Command {
	private client = this.container.client

	public async messageRun(message: Message) {
		if (!message.channel.isSendable()) return

		return this.handleDogPicture((content) => (message.channel as TextChannel).send(content))
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		return this.handleDogPicture((content) => interaction.reply(content))
	}

	private async handleDogPicture(sendFn: (content: any) => Promise<any>) {
		try {
			const response: DogApiResponse = await this.client.tasks.get('getdogpicture').exec()

			if (!response || response.status !== 'success' || !response.message) {
				return sendFn({ content: 'No dog pictures found. Please try again later.' })
			}

			const embed = createAnimalEmbed('🐶 Random Dog', response.message, Colors.DogTeal)

			return sendFn({ embeds: [embed] })
		} catch {
			return sendFn({ content: 'Failed to fetch dog picture. Please try again later.' })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('dog').setDescription('Returns a random dog picture.'))
	}
}
