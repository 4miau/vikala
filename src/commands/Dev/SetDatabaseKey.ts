import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Guild, Message, TextChannel } from 'discord.js'
import { getInput, yes } from '../../lib/util/utilities'

@ApplyOptions<Command.Options>({
	name: 'setdatabasekey',
	aliases: ['setdbkey'],
	description: 'Sets a database key for a guild.',
	usage: 'setdatabasekey <key> <value> [--guild <guildId>]',
	examples: [{ example: 'setdatabasekey prefix ! --guild 123456789012345678', description: 'Sets the prefix key to "!" for the specified guild.' }],
	preconditions: ['OwnerOnly'],
	options: ['guild']
})
export class SetDatabaseKey extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const key = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!key) return message.channel.send({ content: 'No key provided.' })

		const value = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!value) return message.channel.send({ content: 'No value provided.' })

		const guildResolvable = args.getOption('guild')

		return this.handleSetKey(key, value, guildResolvable, {
			sendMessage: (content) => (message.channel as TextChannel).send(content),
			userId: message.author.id,
			channel: message.channel,
			requireConfirmation: true
		})
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const key = interaction.options.getString('key', true)
		const value = interaction.options.getString('value', true)
		const guildResolvable = interaction.options.getString('guild')

		return this.handleSetKey(key, value, guildResolvable, {
			sendMessage: (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }),
			userId: interaction.user.id,
			channel: null,
			requireConfirmation: false
		})
	}

	private async handleSetKey(
		key: string,
		value: string,
		guildResolvable: string | null,
		context: {
			sendMessage: (content: any) => Promise<any>
			userId: string
			channel: any
			requireConfirmation: boolean
		}
	) {
		let guild: Guild

		if (!guildResolvable) guild = context.channel?.guild
		else {
			try {
				guild = await this.client.guilds.fetch(guildResolvable)
			} catch {
				return context.sendMessage({ content: 'Guild not found.' })
			}
		}

		if (!guild) return context.sendMessage({ content: 'Guild not found.' })

		if (context.requireConfirmation) {
			const confirmation = await context.sendMessage({
				content: `Are you sure you want to set the database key for ${guildResolvable ? `the guild (${guild.name})` : 'this guild'}. Key: \`${key}\`? Reply with \`yes\` to confirm.`
			})
			const response = (await getInput(context.channel, { userId: context.userId, deleteAfter: true, reqMsg: confirmation }))[0]

			if (!yes(response)) return context.sendMessage({ content: 'Operation cancelled.' })
		}

		this.client.settings.set(guild, key, value)
		return context.sendMessage({
			content: guildResolvable ? `Database key has been set for guild \`${guild.name}\`.` : 'Database key has been set for this guild.'
		})
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('setdatabasekey')
				.setDescription('Sets a database key for a guild.')
				.addStringOption((option) =>
					option
						.setName('key')
						.setDescription('The key to set.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('value')
						.setDescription('The value to set.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('guild')
						.setDescription('The guild to set the key for.')
						.setRequired(false)
				)
		)
	}
}
