import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ChannelType, EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'
import { Subcommand } from '@sapphire/plugin-subcommands'

@ApplyOptions<Subcommand.Options>({
	name: 'youtube',
	aliases: ['yt', 'youtubenotifs', 'ytalerts'],
	description: 'Manage YouTube channel notifications',
	detailedDescription:
		'Add, remove, and manage YouTube channels to get notified when they post a new video or short. When using add, the channel handle is required. ' +
		'Channel and message are optional. If no channel is provided, the current channel will be used. When using message, you can use the keywords `default` ' +
		'to reset to the default message, and `none` to remove the message entirely (must have embed enabled). ' +
		'By default, livestreams are excluded from notifications. Use the `streams` subcommand to include them. ' +
		'Available message keywords: `{name}`, `{title}`, `{link}`.',
	usage: 'youtube <list> | <add|remove|move|message|embed|streams> [options]',
	examples: [
		{ example: 'youtube list', description: 'Lists all tracked YouTube channels.' },
		{ example: 'youtube add @mkbhd', description: 'Adds MKBHD as a tracked channel with default settings.' },
		{
			example: 'youtube add @mkbhd #videos Check out this new video: {title}!',
			description: 'Adds MKBHD and posts a custom message in #videos when they upload.'
		},
		{ example: 'youtube remove @mkbhd', description: 'Removes MKBHD from the tracked channels.' },
		{ example: 'youtube move @mkbhd #uploads', description: 'Moves MKBHD notifications to the #uploads channel.' },
		{ example: 'youtube message @mkbhd default', description: "Resets MKBHD's notification message to the default." },
		{ example: 'youtube message @mkbhd {name} just dropped {title}!', description: 'Sets a custom notification message.' },
		{ example: 'youtube embed @mkbhd false', description: 'Disables embed notifications for MKBHD.' },
		{ example: 'youtube streams @mkbhd true', description: 'Enables livestream notifications for MKBHD.' }
	],
	runIn: ['GUILD_ANY'],
	subcommands: [
		{ name: 'list', messageRun: 'youtubeMsgList', chatInputRun: 'youtubeInputList', default: true },
		{ name: 'add', messageRun: 'youtubeMsgAdd', chatInputRun: 'youtubeInputAdd', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'remove', messageRun: 'youtubeMsgRemove', chatInputRun: 'youtubeInputRemove', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'move', messageRun: 'youtubeMsgMove', chatInputRun: 'youtubeInputMove', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'message', messageRun: 'youtubeMsgMessage', chatInputRun: 'youtubeInputMessage', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'embed', messageRun: 'youtubeMsgEmbed', chatInputRun: 'youtubeInputEmbed', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'streams', messageRun: 'youtubeMsgStreams', chatInputRun: 'youtubeInputStreams', requiredUserPermissions: ['ManageGuild'] },
		{ name: 'next', messageRun: 'youtubeMsgNext' }
	]
})
export class YouTube extends Subcommand {
	client = this.container.client

	youtubeMsgList(message: Message) {
		if (!message.channel.isSendable()) return
		return this.handleList(message.guild, (content) => (message.channel as TextChannel).send(content))
	}

	youtubeInputList(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.handleList(interaction.guild, (content) => interaction.reply(content))
	}

	async youtubeMsgAdd(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const handle = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const channel = (await args.pickResult('guildTextChannel')).unwrapOrElse(() => message.channel)
		const msg = await args.restResult('string').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleAdd(handle, message.guild, channel.id, msg, (content) => (message.channel as TextChannel).send(content))
	}

	async youtubeInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true)
		const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.GuildAnnouncement])
		const msg = interaction.options.getString('message')

		return this.handleAdd(handle, interaction.guild, channel.id, msg, (content) => interaction.reply(content))
	}

	async youtubeMsgRemove(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const handle = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		return this.handleRemove(handle, message.guild, (content) => (message.channel as TextChannel).send(content))
	}

	async youtubeInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true)
		return this.handleRemove(handle, interaction.guild, (content) => interaction.reply(content))
	}

	async youtubeMsgMove(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const handle = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const channel = await args.pickResult('guildTextChannel').then((res) => (res.isOk() ? res.unwrap() : null))

		if (!channel) return (message.channel as TextChannel).send({ content: 'You must provide a valid text channel to move notifications to.' })

		return this.handleMove(handle, message.guild, channel.id, (content) => (message.channel as TextChannel).send(content))
	}

	async youtubeInputMove(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true)
		const channel = interaction.options.getChannel('channel', true, [ChannelType.GuildText, ChannelType.GuildAnnouncement])

		return this.handleMove(handle, interaction.guild, channel.id, (content) => interaction.reply(content))
	}

	async youtubeMsgMessage(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const handle = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const msg = await args.restResult('string').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleMessage(handle, message.guild, msg, (content) => (message.channel as TextChannel).send(content))
	}

	async youtubeInputMessage(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true)
		const msg = interaction.options.getString('message', true)

		return this.handleMessage(handle, interaction.guild, msg, (content) => interaction.reply(content))
	}

	async youtubeMsgEmbed(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const handle = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const state = await args.pickResult('boolean').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleEmbed(handle, message.guild, state, (content) => (message.channel as TextChannel).send(content))
	}

	youtubeInputEmbed(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true)
		const state = interaction.options.getBoolean('state', true)

		return this.handleEmbed(handle, interaction.guild, state, (content) => interaction.reply(content))
	}

	private async handleList(guild: any, sendFn: (content: any) => Promise<any>) {
		const embed = this.client.youtube.listChannelsEmbed(guild)
		if (!embed) return sendFn({ content: 'No YouTube channels are currently being tracked.', flags: ['Ephemeral'] })
		return sendFn({ embeds: [embed] })
	}

	private async handleAdd(handle: string, guild: any, channelId: string, message: string | null, sendFn: (content: any) => Promise<any>) {
		if (!handle) return sendFn({ content: 'You must provide a YouTube channel handle.', flags: ['Ephemeral'] })

		const success = await this.client.youtube.addChannel(handle, guild, channelId, message)
		if (!success) return sendFn({ content: 'Failed to add channel. Make sure the handle is correct and the channel is not already tracked.', flags: ['Ephemeral'] })

		const normalized = handle.replace(/^@/, '')
		const embed = new EmbedBuilder()
			.setAuthor({ name: `@${normalized}`, url: `https://youtube.com/@${normalized}` })
			.setTitle('YouTube channel added')
			.setDescription(`Notifications will be sent to <#${channelId}> when a new video is posted.`)
			.setColor(Colors.Red)

		return sendFn({ embeds: [embed] })
	}

	private async handleRemove(handle: string, guild: any, sendFn: (content: any) => Promise<any>) {
		if (!handle) return sendFn({ content: 'You must provide a YouTube channel handle to remove.', flags: ['Ephemeral'] })

		const success = await this.client.youtube.removeChannel(handle, guild)
		if (!success) return sendFn({ content: 'Failed to remove channel. Make sure the handle is correct and the channel is being tracked.', flags: ['Ephemeral'] })

		const normalized = handle.replace(/^@/, '')
		const embed = new EmbedBuilder()
			.setTitle(`@${normalized} removed`)
			.setDescription('Notifications will no longer be posted.')
			.setColor(Colors.Red)

		return sendFn({ embeds: [embed] })
	}

	private async handleMove(handle: string, guild: any, channelId: string, sendFn: (content: any) => Promise<any>) {
		if (!handle) return sendFn({ content: 'You must provide a YouTube channel handle to move.', flags: ['Ephemeral'] })

		const success = this.client.youtube.moveChannel(handle, guild, channelId)
		if (!success) return sendFn({ content: 'Failed to move channel notifications.', flags: ['Ephemeral'] })

		const normalized = handle.replace(/^@/, '')
		const embed = new EmbedBuilder()
			.setTitle(`@${normalized} moved`)
			.setDescription(`Notifications will now be sent to <#${channelId}>.`)
			.setColor(Colors.Red)

		return sendFn({ embeds: [embed] })
	}

	private async handleMessage(handle: string, guild: any, message: string, sendFn: (content: any) => Promise<any>) {
		if (!handle) return sendFn({ content: 'You must provide a YouTube channel handle to set the message for.', flags: ['Ephemeral'] })
		if (!message) return sendFn({ content: 'You must provide a valid message.', flags: ['Ephemeral'] })

		const success = this.client.youtube.modifyChannel(handle, guild, { message })
		if (!success) return sendFn({ content: 'Failed to set notification message.', flags: ['Ephemeral'] })

		const normalized = handle.replace(/^@/, '')
		const embed = new EmbedBuilder().setTitle(`Notification message updated for @${normalized}`).setColor(Colors.Red)

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

	private async handleEmbed(handle: string, guild: any, state: boolean, sendFn: (content: any) => Promise<any>) {
		if (!handle) return sendFn({ content: 'You must provide a YouTube channel handle to set the embed preference for.', flags: ['Ephemeral'] })
		if (state === null || state === undefined) return sendFn({ content: 'You must provide a valid state (true/false).', flags: ['Ephemeral'] })

		const success = this.client.youtube.modifyChannel(handle, guild, { embed: state })
		if (!success) return sendFn({ content: 'Failed to set embed preference.', flags: ['Ephemeral'] })

		const normalized = handle.replace(/^@/, '')
		const embed = new EmbedBuilder()
			.setTitle(`Embed preference updated for @${normalized}`)
			.setDescription(`Embed preference set to \`${state}\`.`)
			.setColor(Colors.Red)

		return sendFn({ embeds: [embed] })
	}

	async youtubeMsgStreams(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const handle = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const state = await args.pickResult('boolean').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleStreams(handle, message.guild, state, (content) => (message.channel as TextChannel).send(content))
	}

	youtubeInputStreams(interaction: Subcommand.ChatInputCommandInteraction) {
		const handle = interaction.options.getString('handle', true)
		const state = interaction.options.getBoolean('include', true)

		return this.handleStreams(handle, interaction.guild, state, (content) => interaction.reply(content))
	}

	private async handleStreams(handle: string, guild: any, state: boolean, sendFn: (content: any) => Promise<any>) {
		if (!handle) return sendFn({ content: 'You must provide a YouTube channel handle to set the stream preference for.', flags: ['Ephemeral'] })
		if (state === null || state === undefined) return sendFn({ content: 'You must provide a valid state (true/false).', flags: ['Ephemeral'] })

		const success = this.client.youtube.modifyChannel(handle, guild, { includeStreams: state })
		if (!success) return sendFn({ content: 'Failed to set stream preference.', flags: ['Ephemeral'] })

		const normalized = handle.replace(/^@/, '')
		const embed = new EmbedBuilder()
			.setTitle(`Stream notifications ${state ? 'enabled' : 'disabled'} for @${normalized}`)
			.setDescription(state ? 'Livestreams will now trigger notifications.' : 'Only regular videos and shorts will trigger notifications.')
			.setColor(Colors.Red)

		return sendFn({ embeds: [embed] })
	}

	youtubeMsgNext(message: Message) {
		if (!message.channel.isSendable()) return
		if (message.author.id !== this.client.owner) return

		const next = this.client.youtube.nextPoll
		return (message.channel as TextChannel).send({
			embeds: [
				new EmbedBuilder()
					.setTitle('YouTube — Next video check')
					.setDescription(`<t:${Math.floor(next / 1000)}:R> (<t:${Math.floor(next / 1000)}:T>)`)
					.setColor(Colors.Red)
			]
		})
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('youtube')
				.setDescription('Manage YouTube channel notifications')
				.addSubcommand((sub) =>
					sub
						.setName('list')
						.setDescription('List all tracked YouTube channels')
				)
				.addSubcommand((sub) =>
					sub
						.setName('add')
						.setDescription('Add a YouTube channel to track')
						.addStringOption((option) =>
							option
								.setName('handle')
								.setDescription('The YouTube channel handle (e.g. @mkbhd)')
								.setRequired(true)
						)
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('The Discord channel to send notifications to')
								.setRequired(true)
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Custom notification message. Keywords: {name}, {title}, {link}')
								.setRequired(false)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('remove')
						.setDescription('Remove a tracked YouTube channel')
						.addStringOption((option) =>
							option
								.setName('handle')
								.setDescription('The YouTube channel handle to remove')
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('move')
						.setDescription('Move notifications to a different channel')
						.addStringOption((option) =>
							option
								.setName('handle')
								.setDescription('The YouTube channel handle to move')
								.setRequired(true)
						)
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('The Discord channel to move notifications to')
								.setRequired(true)
								.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('message')
						.setDescription('Set the notification message for a channel')
						.addStringOption((option) =>
							option
								.setName('handle')
								.setDescription('The YouTube channel handle')
								.setRequired(true)
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('The message to send. Keywords: {name}, {title}, {link}. Use `default` or `none`.')
								.setRequired(true)
								.setAutocomplete(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('streams')
						.setDescription('Toggle livestream notifications for a channel')
						.addStringOption((option) =>
							option
								.setName('handle')
								.setDescription('The YouTube channel handle')
								.setRequired(true)
						)
						.addBooleanOption((option) =>
							option
								.setName('include')
								.setDescription('Whether to include livestreams in notifications (default: false)')
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('embed')
						.setDescription('Toggle embed notifications for a channel')
						.addStringOption((option) =>
							option
								.setName('handle')
								.setDescription('The YouTube channel handle')
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
