import { Command } from '@sapphire/framework'
import type { Message } from 'discord.js'
import { ApplyOptions } from '@sapphire/decorators'

@ApplyOptions<Command.Options>({
	name: 'ping',
	aliases: ['pong'],
	description: 'Pong! 🏓',
	detailedDescription: "Checks the bot's latency to Discord and the API response time.",
	usage: 'ping'
})
export class Ping extends Command {
	client = this.container.client

	public async messageRun(message: Message) {
		if (!message.channel.isSendable()) return

		const msg = await message.channel.send('Ping?')
		const content = `Pong 🏓! Bot Latency ${Math.round(this.client.ws.ping)}ms. API Latency ${msg.createdTimestamp - message.createdTimestamp}ms.`

		return msg.edit(content)
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const reply = await interaction.reply({ content: 'Ping?', flags: ['Ephemeral'] })
		const content = `Pong 🏓! Bot Latency ${Math.round(this.client.ws.ping)}ms. API Latency ${
			reply.createdTimestamp - interaction.createdTimestamp
		}ms.`

		return interaction.editReply(content)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('ping')
				.setDescription('Pong! 🏓')
		)
	}
}
