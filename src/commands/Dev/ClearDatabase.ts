import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Guild, Message } from 'discord.js'
import { getInput, yes } from '../../lib/util/utilities'

@ApplyOptions<Command.Options>({
	name: 'cleardatabase',
	aliases: ['cleardb', 'resetdatabase', 'resetdb'],
	description: 'Resets the database.',
	usage: 'cleardatabase [--all] [--guild <guildId>]',
	examples: [
		{ example: 'cleardatabase --guild 123456789012345678', description: 'Clears the database for the specified guild.' },
		{ example: 'cleardatabase --all', description: 'Clears the entire database.' }
	],
	flags: ['all'],
	options: ['guild'],
	preconditions: ['OwnerOnly']
})
export class ClearDatabase extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const guildOption = args.getOption('guild')
		const all = args.getFlags('all')

		if (!guildOption && !all) return message.channel.send({ content: 'Provide a valid guild or use the --all flag.' })

		if (all) {
			const confirmation = await message.channel.send({ content: 'Are you sure you want to clear the entire database? Type "yes" to proceed.' })
			const response = (await getInput(message.channel, { deleteAfter: true, userId: this.client.owner, reqMsg: confirmation }))[0]

			if (!yes(response)) return message.channel.send({ content: 'Operation cancelled.' })

			try {
				this.client.settings.clearAll(this.client)
				return message.channel.send({ content: 'The entire database has been cleared.' })
			} catch {
				return message.channel.send({ content: 'An error occurred while clearing the database.' })
			}
		} else if (guildOption) {
			const guild = this.client.guilds.resolve(guildOption)
			if (!guild) return message.channel.send({ content: 'Failed to resolve guild.' })

			const confirmation = await message.channel.send({
				content: `Are you sure you want to clear the database for guild **${guild.name}**? Type "yes" to proceed.`
			})
			const response = (await getInput(message.channel, { deleteAfter: true, userId: this.client.owner, reqMsg: confirmation }))[0]

			if (!yes(response)) return message.channel.send({ content: 'Operation cancelled.' })

			try {
				this.client.settings.clear(guild)
				return message.channel.send({ content: `The database for guild **${guild.name}** has been cleared.` })
			} catch {
				return message.channel.send({ content: 'An error occurred while clearing the database for the specified guild.' })
			}
		}
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const guildOption = interaction.options.getString('guild')
		const all = interaction.options.getBoolean('all')

		if (!guildOption && !all) return interaction.reply({ content: 'Provide a guild or use the all option.', flags: ['Ephemeral'] })

		if (all) {
			try {
				await this.client.settings.clearAll(this.client)
				return interaction.reply({ content: 'The entire database has been cleared.', flags: ['Ephemeral'] })
			} catch {
				return interaction.reply({ content: 'An error occurred while clearing the database.', flags: ['Ephemeral'] })
			}
		} else if (guildOption) {
			const guild = this.client.guilds.resolve(guildOption)
			if (!guild) return interaction.reply({ content: 'Failed to resolve guild.', flags: ['Ephemeral'] })

			try {
				await this.client.settings.clear(guild)
				return interaction.reply({ content: `The database for guild **${guild.name}** has been cleared.`, flags: ['Ephemeral'] })
			} catch {
				return interaction.reply({ content: 'An error occurred while clearing the database for the specified guild.', flags: ['Ephemeral'] })
			}
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('cleardatabase')
				.setDescription('Resets the database.')
				.addStringOption((option) =>
					option
						.setName('guild')
						.setDescription('The guild to clear the database for')
						.setRequired(false)
				)
				.addBooleanOption((option) =>
					option
						.setName('all')
						.setDescription('Clear the entire database')
						.setRequired(false)
				)
		)
	}
}
