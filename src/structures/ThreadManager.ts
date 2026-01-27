import {
	TextChannel,
	User,
	Message,
	EmbedBuilder,
	AttachmentBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Guild,
	ChannelType,
	PermissionFlagsBits
} from 'discord.js'
import Vikala from '../client/vikala'
import ThreadModel, { IThread } from '../database/Thread'
import { Colors } from '../lib/util/Colors'
import { ThreadConfig } from '../typings/@definitions/Threads'

export default class ThreadManager {
	protected client: Vikala
	private activeThreads: Map<string, IThread> = new Map()

	constructor(cli: Vikala) {
		this.client = cli
	}

	public async _init() {
		await this.reconnectThreads()
	}

	public getThreadByChannelId(channelId: string): IThread | undefined {
		return Array.from(this.activeThreads.values()).find((t) => t.channelId === channelId)
	}

	private async reconnectThreads() {
		const openThreads = await ThreadModel.find({ status: 'open' })

		for (const thread of openThreads) {
			try {
				const guild = this.client.guilds.cache.get(thread.guildId)
				if (!guild) continue

				const channel = guild.channels.cache.get(thread.channelId) as TextChannel
				if (!channel) {
					await ThreadModel.updateOne({ threadId: thread.threadId }, { status: 'closed' })
					continue
				}

				this.activeThreads.set(thread.userId, thread)
			} catch {}
		}
	}

	public async createThread(guild: Guild, user: User, userAnonymous: boolean = false): Promise<TextChannel | null> {
		if (await this.isBlacklisted(guild.id, user.id)) {
			try {
				await user.send('You are currently blacklisted from creating modmail threads.')
			} catch {}
			return null
		}

		if (this.activeThreads.has(user.id)) {
			try {
				await user.send('You already have an activwe modmail thread.')
			} catch {}
			return null
		}

		const config: ThreadConfig = this.client.settings.get(guild, 'thread', {})
		if (!config.categoryId) {
			console.error(`[ThreadManager] Thread category not configured for guild: ${guild.name} (${guild.id})`)
			try {
				await user.send('❌ The Modmail system is not configured on this server. Please ask an administrator to run `/thread setup`.')
			} catch {}
			return null
		}

		const threadCounter = (config.counter || 0) + 1
		this.client.settings.set(guild, 'thread.counter', threadCounter)

		const channelName = userAnonymous ? `thread-${String(threadCounter).padStart(4, '0')}` : `thread-${user.username}-${threadCounter}`

		try {
			const channel = await guild.channels.create({
				name: channelName,
				type: ChannelType.GuildText,
				parent: config.categoryId,
				topic: `Modmail Thread | User: ${user.tag} (${user.id})`,
				permissionOverwrites: [
					{
						id: guild.id,
						deny: [PermissionFlagsBits.ViewChannel]
					},
					{
						id: this.client.user!.id,
						allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
					}
				]
			})

			for (const roleId of config.staffRoles || []) {
				await channel.permissionOverwrites.create(roleId, {
					ViewChannel: true,
					SendMessages: true,
					ReadMessageHistory: true
				})
			}

			const threadId = `${guild.id}-${user.id}-${Date.now()}`
			const thread = await ThreadModel.create({
				threadId,
				guildId: guild.id,
				userId: user.id,
				channelId: channel.id,
				status: 'open',
				userAnonymous,
				messages: []
			})

			this.activeThreads.set(user.id, thread)

			const openEmbed = new EmbedBuilder()
				.setColor(Colors.Blurple)
				.setTitle('📨 New Modmail Thread')
				.setDescription(
					userAnonymous
						? `A new anonymous thread has been created.`
						: `Thread created by ${user.tag}${config.anonymous ? ' (Staff will appear as anonymous)' : ''}`
				)
				.addFields({ name: 'User ID', value: user.id, inline: true }, { name: 'Thread ID', value: threadId, inline: true })
				.setTimestamp()

			const closeButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId(`thread_close_${threadId}`).setLabel('Close Thread').setStyle(ButtonStyle.Danger).setEmoji('🔒')
			)

			await channel.send({ embeds: [openEmbed], components: [closeButton] })

			try {
				const userEmbed = new EmbedBuilder()
					.setColor(Colors.Active)
					.setTitle('📬 Modmail Thread Created')
					.setDescription(
						`Hello there! We have received your message. Please wait while a staff member reaches out to you.\n\nYou can close this thread at any time by clicking the button below.`
					)
					.setFooter({ text: `Thread ID: ${threadId}` })
					.setTimestamp()

				const userCloseButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId(`user_close_${threadId}`).setLabel('Close Thread').setStyle(ButtonStyle.Danger).setEmoji('🔒')
				)

				await user.send({ embeds: [userEmbed], components: [userCloseButton] })
			} catch {
				await channel.send('⚠️ Unable to DM user. They may have DMs disabled.')
			}

			return channel
		} catch (error) {
			console.error('[ThreadManager] Failed to create thread:', error)
			return null
		}
	}

	public async handleUserMessage(user: User, message: Message): Promise<void> {
		const thread = this.activeThreads.get(user.id)
		if (!thread) return

		const guild = this.client.guilds.cache.get(thread.guildId)
		if (!guild) return

		const channel = guild.channels.cache.get(thread.channelId) as TextChannel
		if (!channel) {
			await this.closeThread(thread.threadId, 'System', 'Channel not found')
			return
		}

		const messageData = {
			authorId: user.id,
			authorTag: user.tag,
			content: message.content,
			timestamp: new Date(),
			attachments: message.attachments.map((a) => a.url),
			isStaff: false
		}

		await ThreadModel.updateOne({ threadId: thread.threadId }, { $push: { messages: messageData } })

		const embed = new EmbedBuilder()
			.setColor(Colors.Blurple)
			.setAuthor({
				name: thread.userAnonymous ? 'Anonymous User' : user.username,
				iconURL: thread.userAnonymous ? undefined : user.displayAvatarURL()
			})
			.setDescription(message.content || '*No text content*')
			.setTimestamp(messageData.timestamp)

		if (messageData.attachments.length > 0) {
			embed.addFields({
				name: '📎 Attachments',
				value: messageData.attachments.map((url, i) => `[Attachment ${i + 1}](${url})`).join('\n')
			})
		}

		await channel.send({ embeds: [embed] })
	}

	public async handleStaffMessage(message: Message): Promise<void> {
		const channel = message.channel as TextChannel
		const thread = Array.from(this.activeThreads.values()).find((t) => t.channelId === channel.id)

		if (!thread) return

		const user = await this.client.users.fetch(thread.userId).catch(() => null)
		if (!user) return

		const messageData = {
			authorId: message.author.id,
			authorTag: message.author.tag,
			content: message.content,
			timestamp: new Date(),
			attachments: message.attachments.map((a) => a.url),
			isStaff: true
		}

		await ThreadModel.updateOne({ threadId: thread.threadId }, { $push: { messages: messageData } })

		const staffAnonymousMode = this.client.settings.get(message.guild!, 'thread.anonymous', false)

		const embed = new EmbedBuilder()
			.setColor(Colors.Active)
			.setAuthor({
				name: staffAnonymousMode ? 'Staff' : message.author.tag,
				iconURL: staffAnonymousMode ? undefined : message.author.displayAvatarURL()
			})
			.setDescription(message.content || '*No text content*')
			.setTimestamp(messageData.timestamp)

		if (messageData.attachments.length > 0) {
			embed.addFields({
				name: '📎 Attachments',
				value: messageData.attachments.map((url, i) => `[Attachment ${i + 1}](${url})`).join('\n')
			})
		}

		try {
			await user.send({ embeds: [embed] })
			await message.react('✅')
		} catch (error) {
			await message.reply('⚠️ Unable to send message to user. They may have DMs disabled.')
		}
	}

	public async closeThread(threadId: string, closedBy: string, reason?: string): Promise<void> {
		const thread = await ThreadModel.findOne({ threadId })
		if (!thread || thread.status === 'closed') return

		this.activeThreads.delete(thread.userId)

		await ThreadModel.updateOne({ threadId }, { status: 'closed', closedAt: new Date(), closedBy })

		const guild = this.client.guilds.cache.get(thread.guildId)
		if (!guild) return

		const channel = guild.channels.cache.get(thread.channelId) as TextChannel
		if (channel) {
			const transcript = await this.generateTranscript(thread)
			const transcriptChannel = this.client.settings.get(guild, 'thread.transcriptChannel', null)

			if (transcriptChannel) {
				const transcriptChan = guild.channels.cache.get(transcriptChannel) as TextChannel
				if (transcriptChan) {
					const attachment = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${threadId}.html` })

					const closeEmbed = new EmbedBuilder()
						.setColor(Colors.Critical)
						.setTitle('🔒 Thread Closed')
						.addFields(
							{ name: 'Thread ID', value: threadId, inline: true },
							{ name: 'Closed By', value: closedBy, inline: true },
							{ name: 'Messages', value: thread.messages.length.toString(), inline: true }
						)
						.setTimestamp()

					if (reason) closeEmbed.addFields({ name: 'Reason', value: reason })

					await transcriptChan.send({ embeds: [closeEmbed], files: [attachment] })
				}
			}

			const user = await this.client.users.fetch(thread.userId).catch(() => null)
			if (user) {
				try {
					const userTranscript = new AttachmentBuilder(Buffer.from(transcript, 'utf-8'), { name: `transcript-${threadId}.html` })

					const userEmbed = new EmbedBuilder()
						.setColor(Colors.Critical)
						.setTitle('🔒 Your Modmail Thread Has Been Closed')
						.setDescription(reason ? `**Reason:** ${reason}` : 'Your thread has been closed.')
						.setFooter({ text: `Thread ID: ${threadId}` })
						.setTimestamp()

					await user.send({ embeds: [userEmbed], files: [userTranscript] })
				} catch {}
			}

			await channel.delete('Thread closed')
		}
	}

	private async generateTranscript(thread: IThread): Promise<string> {
		return await this.client.tasks.get('generatetranscript').exec(thread)
	}

	public async isBlacklisted(guildId: string, userId: string): Promise<boolean> {
		const blacklist = this.client.settings.get(guildId, 'thread.blacklist', [])
		return blacklist.includes(userId)
	}

	public getActiveThread(userId: string): IThread | undefined {
		return this.activeThreads.get(userId)
	}

	public isThreadChannel(channelId: string): boolean {
		return Array.from(this.activeThreads.values()).some((t) => t.channelId === channelId)
	}

	public async handleChannelDeleted(guildId: string, channelId: string): Promise<void> {
		const config: ThreadConfig = this.client.settings.get(guildId, 'thread', {})
		let updated = false

		if (config.categoryId === channelId) {
			config.categoryId = null
			updated = true
		}

		if (config.transcriptChannel === channelId) {
			config.transcriptChannel = null
			updated = true
		}

		if (config.setupChannelId === channelId) {
			config.setupMessageId = null
			config.setupChannelId = null
			updated = true
		}

		if (updated) {
			this.client.settings.set(guildId, 'thread', config)
		}
	}

	public async handleRoleDeleted(guildId: string, roleId: string): Promise<void> {
		const staffRoles = this.client.settings.get(guildId, 'thread.staffRoles', [])

		if (staffRoles.includes(roleId)) {
			const updatedRoles = staffRoles.filter((id: string) => id !== roleId)
			this.client.settings.set(guildId, 'thread.staffRoles', updatedRoles)
			console.log(`[Modmail] Staff role was deleted, removed from configuration.`)
		}
	}

	public getAnonymousPromptEmbed() {
		return new EmbedBuilder()
			.setColor(Colors.Blurple)
			.setTitle('📬 Create Modmail Thread')
			.setDescription(
				'Would you like to create your thread anonymously?\n\n**Anonymous:** Your username will be hidden from staff.\n**Regular:** Staff will see your username.'
			)
			.setFooter({ text: 'Choose an option below' })
	}

	public getAnonymousPromptButtons() {
		return new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('create_thread_regular').setLabel('Regular').setStyle(ButtonStyle.Primary).setEmoji('👤'),
			new ButtonBuilder().setCustomId('create_thread_anonymous').setLabel('Anonymous').setStyle(ButtonStyle.Secondary).setEmoji('🕵️')
		)
	}
}
