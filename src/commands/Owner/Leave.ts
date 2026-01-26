import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'leave',
	aliases: [],
	description: 'Makes the bot leave the current guild.',
	usage: 'leave',
	preconditions: ['OwnerOnly'],
	runIn: ['GUILD_ANY']
})
export class Leave extends Command {
	client = this.container.client

	public async messageRun(message: Message) {
		await message.guild.leave()
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.guild.leave()
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('leave').setDescription('Makes the bot leave the current guild.'))
	}
}
