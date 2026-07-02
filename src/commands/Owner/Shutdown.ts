import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'shutdown',
	aliases: [],
	description: 'Shuts down the bot safely.',
	preconditions: ['OwnerOnly']
})
export class Shutdown extends Command {
	private client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		return message.channel.send('Shutting down...').then(() => {
			this.client.logger.fatal('Shutdown command issued, shutting down now.')
			this.client.destroy()
		})
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('shutdown')
				.setDescription('Shuts down the bot safely.')
		)
	}
}
