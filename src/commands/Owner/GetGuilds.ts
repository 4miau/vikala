import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'getguilds',
	aliases: ['guilds'],
	description: 'Get a list of all guilds the bot is in',
	usage: 'getguilds',
	examples: [{ example: 'getguilds', description: 'Gets a list of all guilds the bot is in.' }],
	preconditions: ['OwnerOnly']
})
export class GetGuilds extends Command {
	client = this.container.client

	public async messageRun(message: Message) {
		if (!message.channel.isSendable()) return

		const guilds = this.client.guilds.cache.map((g) => `${g.name} | ${g.id}`).join('\n')
		return message.channel.send({ content: `\`\`\`yaml\n${guilds}\n\`\`\`` })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const guilds = this.client.guilds.cache.map((g) => `${g.name} | ${g.id}`).join('\n')
		return interaction.reply({ content: `\`\`\`yaml\n${guilds}\n\`\`\``, flags: ['Ephemeral'] })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('getguilds').setDescription('Get a list of all guilds the bot is in'))
	}
}
