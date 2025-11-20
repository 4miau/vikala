import { Command } from '@sapphire/framework'
import type { Message, TextChannel } from 'discord.js'
import { ApplyOptions } from '@sapphire/decorators'

@ApplyOptions<Command.Options>({
	name: 'ping',
	aliases: ['pong'],
	description: 'Pong! 🏓',
	detailedDescription: 'Checks the bot\'s latency to Discord and the API response time.',
	usage: 'ping'
})
export class Ping extends Command {
	client = this.container.client

	public async messageRun(message: Message) {
		if (!message.channel.isTextBased()) return

		const channel = message.channel as TextChannel
		const msg = await channel.send('Ping?')

		const content = `Pong! Bot Latency ${Math.round(this.client.ws.ping)}ms. API Latency ${
			msg.createdTimestamp - message.createdTimestamp
		}ms.`

		return msg.edit(content)
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply()
		const reply = await interaction.followUp({ content: 'Ping?', flags: ['Ephemeral'] })

		try {
			const diff = reply.createdTimestamp - interaction.createdTimestamp
			const ping = Math.round(this.container.client.ws.ping)

			return reply.edit(`Pong 🏓! (Round trip took: ${diff}ms. Heartbeat: ${ping}ms.)`)
		} catch {
			return reply.edit({ content: 'Failed to retrieve ping :('  })
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('ping')
				.setDescription('Pong! 🏓')
		)
	}
}