import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ChannelType, EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Subcommand } from '@sapphire/plugin-subcommands'

@ApplyOptions<Subcommand.Options>({
	name: 'twitch',
	aliases: ['twitch_alerts', 'streamers', 'twitchalerts'],
	description: 'Manage Twitch streamers',
	detailedDescription:
		'Add, remove, and manage Twitch streamers to get notified when they go live. When using add, only the streamer name is required. ' +
		'Channel and message are optional. If no channel is provided, the current channel will be used. When using message, you can use the keywords `default` ' +
		'to reset to the default message, and `none` to remove the message entirely (must have embed enabled).',
	usage: 'twitch <list|status> | <add|remove|move|message|embed> [options]',
	examples: [
		{ example: 'twitch list', description: 'Lists all tracked Twitch streamers.' },
		{ example: 'twitch status 4miau', description: 'Shows the status of 4miau\'s stream (live or offline).' },
		{ example: 'twitch add 4miau', description: 'Adds 4miau as a tracked streamer with default settings.' },
		{
			example: 'twitch add 4miau #general Welcome to the stream!',
			description: 'Adds 4miau as a tracked streamer and posts a message in #general when they go live.'
		},
		{ example: 'twitch remove 4miau', description: 'Removes 4miau from the tracked streamers.' },
		{ example: 'twitch move 4miau #streams', description: "Moves 4miau's notifications to the #streams channel." },
		{ example: 'twitch message 4miau default', description: "Resets 4miau's stream message to the default message." },
		{ example: 'twitch message 4miau Welcome to the stream!', description: 'Sets 4miau\'s stream message to "Welcome to the stream!".' },
		{ example: 'twitch embed 4miau true', description: "Sets 4miau's notifications to use embeds." }
	],
	runIn: ['GUILD_ANY'],
	subcommands: [
		{ name: 'list', messageRun: 'twitchMsgList', chatInputRun: 'twitchInputList', default: true },
		{ name: 'status', messageRun: 'twitchMsgStatus', chatInputRun: 'twitchInputStatus' },
		{ name: 'add', messageRun: 'twitchMsgAdd', chatInputRun: 'twitchInputAdd', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'remove', messageRun: 'twitchMsgRemove', chatInputRun: 'twitchInputRemove', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'move', messageRun: 'twitchMsgMove', chatInputRun: 'twitchInputMove', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'message', messageRun: 'twitchMsgMessage', chatInputRun: 'twitchInputMessage', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'embed', messageRun: 'twitchMsgEmbed', chatInputRun: 'twitchInputEmbed', requiredUserPermissions: ['ManageGuild'] }
	]
})
export class Twitch extends Subcommand {
	client = this.container.client

	twitchMsgList(message: Message) {
		if (!message.channel.isSendable()) return
		return this.handleList(message.guild, (content) => (message.channel as TextChannel).send(content))
	}

	twitchInputList(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.handleList(interaction.guild, (content) => interaction.reply(content))
	}

	twitchMsgStatus(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		return this.handleStatus(args, (content) => (message.channel as TextChannel).send(content))
	}

	twitchInputStatus(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.handleStatus(interaction.options, (content) => interaction.reply(content))
	}

	async twitchMsgAdd(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const name = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const channel = (await args.pickResult('guildTextChannel')).unwrapOrElse(() => message.channel)
		const msg = await args.restResult('string').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleAdd(name, message.guild, channel.id, msg, (content) => (message.channel as TextChannel).send(content))
	}

	async twitchInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true)
		const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText])
		const msg = interaction.options.getString('message')

		return this.handleAdd(name, interaction.guild, channel.id, msg, (content) => interaction.reply(content))
	}

	async twitchMsgRemove(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const name = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		return this.handleRemove(name, message.guild, (content) => (message.channel as TextChannel).send(content))
	}

	async twitchInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true)
		return this.handleRemove(name, interaction.guild, (content) => interaction.reply(content))
	}

	async twitchMsgMove(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const name = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const channel = await args.pickResult('guildTextChannel').then((res) => (res.isOk() ? res.unwrap() : null))

		if (!channel) {
			return (message.channel as TextChannel).send({ content: 'You must provide a valid text channel to move notifications to.' })
		}

		return this.handleMove(name, message.guild, channel.id, (content) => (message.channel as TextChannel).send(content))
	}

	async twitchInputMove(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true)
		const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.GuildAnnouncement])

		return this.handleMove(name, interaction.guild, channel.id, (content) => interaction.reply(content))
	}

	async twitchMsgMessage(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const name = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const msg = await args.restResult('string').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleMessage(name, message.guild, msg, (content) => (message.channel as TextChannel).send(content))
	}

	async twitchInputMessage(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true)
		const msg = interaction.options.getString('message', true)

		return this.handleMessage(name, interaction.guild, msg, (content) => interaction.reply(content))
	}

	async twitchMsgEmbed(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const name = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const state = await args.pickResult('boolean').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleEmbed(name, message.guild, state, (content) => (message.channel as TextChannel).send(content))
	}

	twitchInputEmbed(interaction: Subcommand.ChatInputCommandInteraction) {
		const name = interaction.options.getString('name', true)
		const state = interaction.options.getBoolean('state', true)

		return this.handleEmbed(name, interaction.guild, state, (content) => interaction.reply(content))
	}

	private async handleList(guild: any, sendFn: (content: any) => Promise<any>) {
		const embed = this.client.twitch.listStreamersEmbed(guild)
		if (!embed) {
			return sendFn({ content: 'No streamers are currently being tracked.', flags: ['Ephemeral'] })
		}
		return sendFn({ embeds: [embed] })
	}

	private async handleStatus(options: any, sendFn: (content: any) => Promise<any>) {
		const name = options.getString('name', true)
		const status = await this.client.twitch.getStreamerStatus(name)
		if (!status) {
			return sendFn({ content: 'Failed to fetch streamer status.', flags: ['Ephemeral'] })
		}

		const embed = new EmbedBuilder()
			.setAuthor({ name: name, url: `https://twitch.tv/${name}` })
			.setTitle('Streamer Status')
			.addFields(
				{ name: 'Live', value: status.is_live ? 'Yes' : 'No', inline: true },
				{ name: 'Message Posted?', value: status.msg ? 'Last stream has been posted' : 'Last stream has not yet been posted', inline: true },
				{ name: 'Stream Info', value: status.stream ? `[${status.stream.title}](https://twitch.tv/${name})` : 'No stream info available', inline: false }
			)

		return sendFn({ embeds: [embed] })
	}

	private async handleAdd(name: string, guild: any, channelId: string, message: string | null, sendFn: (content: any) => Promise<any>) {
		const success = await this.client.twitch.addStreamer(name, guild, channelId, message)
		if (!success) {
			return sendFn({ content: 'Failed to add streamer.', flags: ['Ephemeral'] })
		}

		const embed = new EmbedBuilder()
			.setAuthor({ name: name, url: `https://twitch.tv/${name}` })
			.setTitle('Streamer added')
			.setDescription(`Notifications will be sent to <#${channelId}>.`)

		return sendFn({ embeds: [embed] })
	}

	private async handleRemove(name: string, guild: any, sendFn: (content: any) => Promise<any>) {
		if (!name) {
			return sendFn({ content: 'You must provide a streamer name to remove.', flags: ['Ephemeral'] })
		}

		const success = await this.client.twitch.removeStreamer(name, guild)
		if (!success) {
			return sendFn({ content: 'Failed to remove streamer.', flags: ['Ephemeral'] })
		}

		const embed = new EmbedBuilder().setTitle(`${name} removed`).setDescription('Notifications will no longer be posted.')

		return sendFn({ embeds: [embed] })
	}

	private async handleMove(name: string, guild: any, channelId: string, sendFn: (content: any) => Promise<any>) {
		if (!name) {
			return sendFn({ content: 'You must provide a streamer name to move.', flags: ['Ephemeral'] })
		}

		const success = this.client.twitch.moveStreamer(name, guild, channelId)
		if (!success) {
			return sendFn({ content: 'Failed to move streamer notifications.', flags: ['Ephemeral'] })
		}

		const embed = new EmbedBuilder().setTitle(`${name} moved`).setDescription(`Notifications will now be sent to <#${channelId}>.`)

		return sendFn({ embeds: [embed] })
	}

	private async handleMessage(name: string, guild: any, message: string, sendFn: (content: any) => Promise<any>) {
		if (!name) {
			return sendFn({ content: 'You must provide a streamer name to set the message for.', flags: ['Ephemeral'] })
		}
		if (!message) {
			return sendFn({ content: 'You must provide a valid message.', flags: ['Ephemeral'] })
		}

		const success = this.client.twitch.modifyStreamer(name, guild, { message })
		if (!success) {
			return sendFn({ content: 'Failed to set stream message.', flags: ['Ephemeral'] })
		}

		const embed = new EmbedBuilder().setTitle(`Stream message updated for ${name}`)

		switch (message) {
			case 'none':
				embed.setDescription('The message has been removed.')
				break
			case 'default':
				embed.setDescription('The message has been reset to the default message.')
				break
			default:
				embed.setDescription(`New message: ${message}`)
		}

		return sendFn({ embeds: [embed] })
	}

	private async handleEmbed(name: string, guild: any, state: boolean, sendFn: (content: any) => Promise<any>) {
		if (!name) {
			return sendFn({ content: 'You must provide a streamer name to set the embed for.', flags: ['Ephemeral'] })
		}
		if (state === null || state === undefined) {
			return sendFn({ content: 'You must provide a valid state (true/false) to set embed preference.', flags: ['Ephemeral'] })
		}

		const success = this.client.twitch.modifyStreamer(name, guild, { embed: state })
		if (!success) {
			return sendFn({ content: 'Failed to set embed preference.', flags: ['Ephemeral'] })
		}

		const embed = new EmbedBuilder().setTitle(`Embed preference updated for ${name}`).setDescription(`Embed preference set to \`${state}\`.`)

		return sendFn({ embeds: [embed] })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('twitch')
				.setDescription('Manage Twitch streamers')
				.addSubcommand((sub) =>
					sub
						.setName('list')
						.setDescription('List all streamers being tracked')
				)
				.addSubcommand((sub) =>
					sub
						.setName('add')
						.setDescription('Add a streamer to track')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('The name of the streamer to add')
								.setRequired(true)
						)
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('The channel to send notifications to')
								.setRequired(true)
								.addChannelTypes(
								ChannelType.GuildText,
								ChannelType.GuildAnnouncement
							)
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('The message to send when the streamer goes live')
								.setRequired(false)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('remove')
						.setDescription('Remove a streamer from tracking')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('The name of the streamer to remove')
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('move')
						.setDescription('Move notifications to a different channel')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('The name of the streamer to move')
								.setRequired(true)
						)
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('The channel to move notifications to')
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('message')
						.setDescription('Set the message to send when the streamer goes live')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('The name of the streamer to set the message for')
								.setRequired(true)
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('The message to send when the streamer goes live. Available keywords: `default`, `none`')
								.setRequired(true)
							.setAutocomplete(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('embed')
						.setDescription('Set whether to send an embed when the streamer goes live')
						.addStringOption((option) =>
							option
								.setName('name')
								.setDescription('The name of the streamer to set the embed preference for')
								.setRequired(true)
						)
						.addBooleanOption((option) =>
							option
								.setName('state')
								.setDescription('Whether to send an embed')
								.setRequired(true)
						)
				)
		)
	}
}
