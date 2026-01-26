import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, type Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'guildicon',
	aliases: [],
	description: 'Displays the guild icon',
	usage: 'guildicon',
	runIn: ['GUILD_ANY']
})
export class GuildIcon extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const e = new EmbedBuilder()
			.setAuthor({ name: message.guild.name, iconURL: message.guild.iconURL() })
			.setImage(message.guild.iconURL({ size: 4096 }))

		return message.channel.send({ embeds: [e] })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const e = new EmbedBuilder()
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
			.setImage(interaction.guild.iconURL({ size: 4096 }))

		return await interaction.reply({ embeds: [e], flags: ['Ephemeral'] })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) => builder.setName('guildicon').setDescription('Displays the guild icon'))
	}
}
