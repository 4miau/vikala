import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ChannelType, Guild, type Message } from 'discord.js'
import { capitalize } from 'miau-utilities'

declare type LogType = 'channel' | 'message' | 'guild' | 'moderation' | 'role' | 'user'

@ApplyOptions<Subcommand.Options>({
	name: 'setlogs',
	aliases: ['setlog', 'logs'],
	description: 'Set a channel to post logs (use help for more details).',
	detailedDescription:
		'Sets a channel to post logs for various events being: messages, guild changes, moderation actions, channel updates, roles and users.\n' +
		'There are 6 flags: channel, message, guild, moderation, role, and user. Using the flag "all" will affect everything preceding.',
	usage: 'setlogs [list] | [set|remove] [channel] [--flags]',
	examples: [
		{ example: 'setlogs list', description: 'Lists all log channels.' },
		{ example: 'setlogs set #logs --message --moderation', description: 'Sets the Message and Moderation log channels to #logs.' },
		{ example: 'setlogs remove --role', description: 'Removes the Role log channel.' }
	],
	subcommands: [
		{ name: 'list', messageRun: 'msgList', chatInputRun: 'inputList' },
		{ name: 'set', messageRun: 'msgSet', chatInputRun: 'inputSet' },
		{ name: 'remove', messageRun: 'msgRemove', chatInputRun: 'inputRemove' }
	],
	runIn: ['GUILD_ANY'],
	flags: ['channel', 'message', 'guild', 'moderation', 'role', 'user', 'all']
})
export class SetLogs extends Subcommand {
	private client = this.container.client

	public async msgList(message: Message) {
		if (!message.channel.isSendable()) return

		const logChannels = this.getLogChannels(message.guild)
		return message.channel.send({
			content: logChannels.map((chnl) => `:inbox_tray: ${capitalize(chnl.key.split('.').pop())}: ${chnl.value}`).join('\n')
		})
	}

	public async inputList(interaction: Subcommand.ChatInputCommandInteraction) {
		const logChannels = this.getLogChannels(interaction.guild)
		return interaction.reply({
			content: logChannels.map((chnl) => `:inbox_tray: ${capitalize(chnl.key.split('.').pop())}: ${chnl.value}`).join('\n'),
			flags: ['Ephemeral']
		})
	}

	private getLogChannels(guild: Guild) {
		return this.client.settings.getArr(guild, [
			{ key: 'logs.channel', value: 'N/A' },
			{ key: 'logs.message', value: 'N/A' },
			{ key: 'logs.guild', value: 'N/A' },
			{ key: 'logs.moderation', value: 'N/A' },
			{ key: 'logs.role', value: 'N/A' },
			{ key: 'logs.user', value: 'N/A' }
		])
	}

	async msgSet(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const channel = await args.pickResult('guildTextChannel').then((res) => (res.isOk ? res.unwrap() : null))
		if (!channel) return message.channel.send({ content: 'Provide a valid channel.' })

		const logTypes: LogType[] = this.parseLogTypeFlags(args)

		await this.setLogTypes(logTypes, message, channel.id)
		return message.channel.send({ content: `${capitalize(logTypes.join(', '))} Logs set to ${channel}.` })
	}

	async inputSet(interaction: Subcommand.ChatInputCommandInteraction) {
		const channel = interaction.options.getChannel('channel', true, [
			ChannelType.GuildText,
			ChannelType.GuildForum,
			ChannelType.GuildAnnouncement,
			ChannelType.PublicThread,
			ChannelType.PrivateThread
		])
		if (!channel) return interaction.reply({ content: 'Provide a valid channel.', flags: ['Ephemeral'] })

		const flag = interaction.options.getString('logtype', true).toLowerCase() as LogType
		if (!flag || !['channel', 'message', 'guild', 'moderation', 'role', 'user'].includes(flag)) {
			return interaction.reply({ content: 'Provide a valid log type.', flags: ['Ephemeral'] })
		}

		await this.setLogTypes([flag], interaction, channel.id)
		return interaction.reply({ content: `${capitalize(flag)} Logs set to ${channel}.`, flags: ['Ephemeral'] })
	}

	async msgRemove(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const logTypes: LogType[] = this.parseLogTypeFlags(args)

		await this.removeLogTypes(logTypes, message)
		return message.channel.send({ content: `Removed selected log types.` })
	}

	async inputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
		const flag = interaction.options.getString('logtype', true).toLowerCase() as LogType
		if (!flag || !['channel', 'message', 'guild', 'moderation', 'role', 'user'].includes(flag)) {
			return interaction.reply({ content: 'Provide a valid log type.', flags: ['Ephemeral'] })
		}

		await this.removeLogTypes([flag], interaction)
		return interaction.reply({ content: `Removed ${capitalize(flag)} Logs.`, flags: ['Ephemeral'] })
	}

	private parseLogTypeFlags(args: Args): LogType[] {
		const logTypes: LogType[] = []

		if (args.getFlags('all')) return ['channel', 'message', 'guild', 'moderation', 'role', 'user']
		const possibleLogTypes: LogType[] = ['channel', 'message', 'guild', 'moderation', 'role', 'user']

		for (const type of possibleLogTypes) if (args.getFlags(type)) logTypes.push(type)
		return logTypes
	}

	private async setLogTypes(types: LogType[], m: Message | Subcommand.ChatInputCommandInteraction, channelId: string) {
		for (const type of types) await this.client.settings.set(m.guild, `logs.${type}`, channelId)
	}

	private async removeLogTypes(types: LogType[], m: Message | Subcommand.ChatInputCommandInteraction) {
		for (const type of types) await this.client.settings.delete(m.guild, `logs.${type}`)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('setlogs')
				.setDescription('Sets a channel to post logs (leave blank to remove).')
				.addSubcommand((sub) =>
					sub
						.setName('list')
						.setDescription('Lists all log channels.')
				)
				.addSubcommand((sub) =>
					sub
						.setName('set')
						.setDescription('Sets a log channel.')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('The channel to set as log channel.')
								.setRequired(true)
						)
						.addStringOption((option) =>
							option
								.setName('logtype')
								.setDescription('The type of log to set.')
								.setRequired(true)
								.addChoices(
								{ name: 'Channel Logs', value: 'channel' },
								{ name: 'Message Logs', value: 'message' },
								{ name: 'Guild Logs', value: 'guild' },
								{ name: 'Moderation Logs', value: 'moderation' },
								{ name: 'Role Logs', value: 'role' },
								{ name: 'User Logs', value: 'user' }
							)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('remove')
						.setDescription('Removes a log channel.')
						.addStringOption((option) =>
							option
								.setName('logtype')
								.setDescription('The type of log to remove.')
								.setRequired(true)
								.addChoices(
								{ name: 'Channel Logs', value: 'channel' },
								{ name: 'Message Logs', value: 'message' },
								{ name: 'Guild Logs', value: 'guild' },
								{ name: 'Moderation Logs', value: 'moderation' },
								{ name: 'Role Logs', value: 'role' },
								{ name: 'User Logs', value: 'user' }
							)
						)
				)
		)
	}
}
