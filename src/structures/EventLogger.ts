import { AuditLogEvent, ColorResolvable, EmbedBuilder, Guild, GuildChannel, Message, Role, User, GuildMember } from 'discord.js'
import Vikala from '../client/vikala'
import { Colors } from '../lib/util/Colors'
import { compareRoleChanges, compareChannelChanges, compareMemberChanges, compareUserChanges } from '../lib/util/eventUtil'
import EventLog, { IEventLog } from '../database/EventLog'

export default class EventLogger {
	private client: Vikala
	LOGS = {
		1: 'MESSAGE_UPDATED',
		2: 'MESSAGE_DELETED',
		3: 'MESSAGE_BULK_DELETED',
		4: 'CHANNEL_CREATED',
		5: 'CHANNEL_UPDATED',
		6: 'CHANNEL_DELETED',
		7: 'ROLE_CREATED',
		8: 'ROLE_UPDATED',
		9: 'ROLE_DELETED',
		10: 'GUILD_UPDATED',
		11: 'INVITE_CREATED',
		12: 'INVITE_DELETED',
		13: 'USER_UPDATED',
		14: 'GUILD_MEMBER_ADD',
		15: 'GUILD_MEMBER_REMOVE',
		16: 'GUILD_MEMBER_UPDATED'
	}

	constructor(client: Vikala) {
		this.client = client
	}

	private async tryFetch<T>(fetchFn: () => Promise<T>): Promise<T | null> {
		try {
			return await fetchFn()
		} catch {
			return null
		}
	}

	async getEventLog(guild: Guild, caseId: number): Promise<IEventLog | null> {
		return EventLog.findOne({ guildId: guild.id, caseId: caseId })
	}

	async getLatestEventLogs(guild: Guild, limit: number = 10): Promise<IEventLog[]> {
		return EventLog.find({ guildId: guild.id }).sort({ caseId: -1 }).limit(limit)
	}

	async getEventLogsByUser(guild: Guild, userId: string, limit: number = 15): Promise<IEventLog[]> {
		return EventLog.find({ guildId: guild.id, targetId: userId }).sort({ caseId: -1 }).limit(limit)
	}

	formatEventLog(eventLog: IEventLog): string {
		const date = eventLog.createdAt.toISOString().split('T')[1].split('.')[0]
		const emoji = this.getEmoji(eventLog.eventType)
		const actionPhrase = this.getPhrase(eventLog.eventType)

		let logMessage = `\`[${date}]\` \`${eventLog.caseId}\` ${emoji}`

		if (eventLog.targetId) {
			logMessage += ` **${eventLog.targetName}** (${eventLog.targetId})`
		} else if (eventLog.targetName) {
			logMessage += ` **${eventLog.targetName}**`
		}

		logMessage += `${actionPhrase.startsWith("'") ? '' : ' '}${actionPhrase}`

		if (eventLog.eventType.includes('MESSAGE') && eventLog.extras.channelName) {
			logMessage += `<#${eventLog.extras.channelId}>`
		} else if (eventLog.extras.channelName && (eventLog.eventType.includes('CHANNEL') || eventLog.eventType.includes('INVITE'))) {
			logMessage += eventLog.extras.channelName
		}

		if (eventLog.extras.content) {
			logMessage += `\n\`[ Content ]\` ${eventLog.extras.content}`
		} else if (eventLog.extras.beforeContent && eventLog.extras.afterContent) {
			logMessage += `\n\`[ Before ]\` ${eventLog.extras.beforeContent}\n\`[ After ]\` ${eventLog.extras.afterContent}`
		} else if (eventLog.extras.changes) {
			logMessage += `\n\`[ Changes ]\` ${eventLog.extras.changes}`
		}

		return logMessage
	}

	private async sendLogToChannel(guild: Guild, logType: string, logMessage: string, embed: EmbedBuilder | null = null): Promise<void> {
		const channelId = this.client.settings.get(guild, `logs.${logType}`, null)
		if (!channelId) return

		const channel = guild.channels.cache.get(channelId)
		if (!channel || !channel.isTextBased()) return

		this.tryFetch(async () => {
			const messageOptions: any = { content: logMessage }
			if (embed) messageOptions.embeds = [embed]

			await channel.send(messageOptions)
		})
	}

	validate(guild: Guild, type: string) {
		const isValid: boolean = this.client.settings.get(guild, `logs.${type}`, false)
		return isValid ? true : false
	}

	private isBot(user?: User): boolean {
		return user?.bot === true
	}

	private async createLogEntry(
		guild: Guild,
		eventType: EventActions,
		logType: string,
		color: ColorResolvable,
		data: {
			targetUser?: { username: string; id: string }
			targetName?: string
			channelId?: string
			channelName?: string
			content?: string
			beforeContent?: string
			afterContent?: string
			messageId?: string
		} = {}
	): Promise<void> {
		if (!this.validate(guild, logType)) return

		const caseId = await this.client.settings.getNextCaseId(guild)

		await new EventLog({
			id: (await EventLog.countDocuments()) + 1,
			guildId: guild.id,
			caseId: caseId,
			eventType: eventType,
			targetId: data.targetUser?.id,
			targetName: data.channelName || data.targetName,
			extras: {
				channelId: data.channelId,
				channelName: data.channelName,
				content: data.content,
				beforeContent: data.beforeContent,
				afterContent: data.afterContent,
				messageId: data.messageId,
				changes: data.content
			}
		}).save()

		const date = new Date().toISOString().split('T')[1].split('.')[0]
		const emoji = this.getEmoji(eventType)
		const actionPhrase = this.getPhrase(eventType)

		let logMessage = `\`[${date}]\` \`${caseId}\` ${emoji}`

		if (data.targetUser) logMessage += ` **${data.targetUser.username}** (${data.targetUser.id})`
		logMessage += `${actionPhrase.startsWith("'") ? '' : ' '}${actionPhrase}`
		if (data.targetName || data.channelName) logMessage += `${data.targetName || `${data.channelName} (<#${data.channelId}>)`}`

		logMessage += '\n'

		const embedDescription =
			data.content || data.beforeContent || data.afterContent
				? data.beforeContent && data.afterContent
					? `**Before:** ${data.beforeContent}\n**After:** ${data.afterContent}`
					: data.content
				: undefined

		const embed = embedDescription ? new EmbedBuilder().setColor(color).setDescription(embedDescription) : null

		await this.sendLogToChannel(guild, logType, logMessage, embed)
	}

	getEmoji(action: EventActions): string {
		switch (action) {
			case 'MESSAGE_DELETED':
				return '❌'
			case 'MESSAGE_UPDATED':
				return '⚠️'
			case 'MESSAGE_BULK_DELETED':
				return '🚮'
			case 'CHANNEL_CREATED':
				return '📁'
			case 'CHANNEL_UPDATED':
				return '🧵'
			case 'CHANNEL_DELETED':
				return '❌'
			case 'ROLE_CREATED':
				return '➕'
			case 'ROLE_UPDATED':
				return '✏️'
			case 'ROLE_DELETED':
				return '⛔'
			case 'GUILD_UPDATED':
				return '⚙️'
			case 'INVITE_CREATED':
				return '🔗'
			case 'INVITE_DELETED':
				return '⛓️‍💥'
			case 'USER_UPDATED':
				return '🛡️'
			case 'GUILD_MEMBER_ADD':
				return '➕'
			case 'GUILD_MEMBER_REMOVE':
				return '🗑️'
			case 'GUILD_MEMBER_UPDATED':
				return '🚧'
		}
	}

	private getPhrase(action: EventActions) {
		switch (action) {
			case 'MESSAGE_DELETED':
				return "'s message has been deleted from "
			case 'MESSAGE_UPDATED':
				return 'edited a message in '
			case 'MESSAGE_BULK_DELETED':
				return 'messages were deleted in '
			case 'CHANNEL_CREATED':
				return 'channel was created: '
			case 'CHANNEL_UPDATED':
				return 'channel was updated: '
			case 'CHANNEL_DELETED':
				return 'channel was deleted: '
			case 'ROLE_CREATED':
				return 'role was created: '
			case 'ROLE_UPDATED':
				return 'role was updated: '
			case 'ROLE_DELETED':
				return 'role was deleted: '
			case 'GUILD_UPDATED':
				return 'guild was updated.'
			case 'INVITE_CREATED':
				return 'an invite was created: '
			case 'INVITE_DELETED':
				return 'an invite was deleted'
			case 'USER_UPDATED':
				return 'user was updated.'
			case 'GUILD_MEMBER_ADD':
				return 'joined the guild'
			case 'GUILD_MEMBER_REMOVE':
				return 'left the guild'
			case 'GUILD_MEMBER_UPDATED':
				return 'was updated in the guild'
		}
	}

	async deletedMessageLog(m: Message) {
		if (!m.guild || !m.author || this.isBot(m.author)) return null

		return this.tryFetch(() =>
			this.createLogEntry(m.guild!, this.LOGS[2] as EventActions, 'message', Colors.Red, {
				targetUser: { username: m.author!.username || m.author!.displayName, id: m.author!.id },
				channelId: m.channel.id,
				channelName: (m.channel as GuildChannel).name || 'Unknown Channel',
				content: m.content,
				messageId: m.id
			})
		)
	}

	async editedMessageLog(oldM: Message, newM: Message) {
		if (!newM.guild || !newM.author || this.isBot(newM.author)) return null

		return this.tryFetch(() =>
			this.createLogEntry(newM.guild!, this.LOGS[1] as EventActions, 'message', Colors.Yellow, {
				targetUser: { username: newM.author!.username, id: newM.author!.id },
				channelId: newM.channel.id,
				channelName: (newM.channel as GuildChannel).name || 'Unknown Channel',
				beforeContent: oldM.content,
				afterContent: newM.content,
				messageId: newM.id
			})
		)
	}

	async bulkDeletedMessagesLog(guild: Guild, channelName: string, count: number) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[3] as EventActions, 'message', Colors.Red, {
				channelName: channelName,
				content: `${count} messages were bulk deleted`
			})
		)
	}

	async channelCreatedLog(channel: GuildChannel) {
		return this.tryFetch(() =>
			this.createLogEntry(channel.guild, this.LOGS[4] as EventActions, 'channel', Colors.Green, {
				channelId: channel.id,
				channelName: channel.name
			})
		)
	}

	async channelUpdatedLog(oldChannel: GuildChannel, newChannel: GuildChannel) {
		const changes = compareChannelChanges(oldChannel, newChannel)
		if (!changes) return null

		return this.tryFetch(() =>
			this.createLogEntry(oldChannel.guild, this.LOGS[5] as EventActions, 'channel', Colors.Yellow, {
				channelId: newChannel.id,
				targetName: newChannel.name,
				content: changes
			})
		)
	}

	async channelDeletedLog(channel: GuildChannel) {
		let channelName = channel?.name
		if (!channelName || channel.partial) {
			const channelInfo = await this.client.channelSnapshots.getChannelInfo(channel.id)
			channelName = channelInfo.name
		}

		return this.tryFetch(() =>
			this.createLogEntry(channel.guild!, this.LOGS[6] as EventActions, 'channel', Colors.Red, {
				channelId: channel.id,
				channelName: channelName
			})
		)
	}

	async roleCreatedLog(guild: Guild, roleName: string) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[7] as EventActions, 'role', Colors.Green, {
				targetName: roleName
			})
		)
	}

	async roleUpdatedLog(oldRole: Role, newRole: Role) {
		const changes = compareRoleChanges(oldRole, newRole)
		if (!changes) return null

		return this.tryFetch(() =>
			this.createLogEntry(oldRole.guild, this.LOGS[8] as EventActions, 'role', Colors.Yellow, {
				targetName: newRole.name,
				content: changes
			})
		)
	}

	async roleDeletedLog(guild: Guild, roleName: string) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[9] as EventActions, 'role', Colors.Red, {
				targetName: roleName
			})
		)
	}

	async guildUpdatedLog(guild: Guild) {
		return this.tryFetch(() => this.createLogEntry(guild, this.LOGS[10] as EventActions, 'guild', Colors.Yellow))
	}

	async inviteCreatedLog(guild: Guild, inviteCode: string) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[11] as EventActions, 'guild', Colors.Green, {
				targetName: inviteCode
			})
		)
	}

	async inviteDeletedLog(guild: Guild, inviteCode: string) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[12] as EventActions, 'guild', Colors.Red, {
				targetName: inviteCode
			})
		)
	}

	async userUpdatedLog(guild: Guild, oldUser: User, newUser: User) {
		if (!newUser || !oldUser) return null

		const changes = compareUserChanges(oldUser, newUser)
		if (!changes) return null

		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[13] as EventActions, 'user', Colors.Yellow, {
				targetUser: { username: newUser.username, id: newUser.id },
				content: changes
			})
		)
	}

	async memberJoinedLog(guild: Guild, username: string, userId: string) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[14] as EventActions, 'user', Colors.Green, {
				targetUser: { username, id: userId }
			})
		)
	}

	async memberLeftLog(guild: Guild, username: string, userId: string) {
		return this.tryFetch(() =>
			this.createLogEntry(guild, this.LOGS[15] as EventActions, 'user', Colors.Red, {
				targetUser: { username, id: userId }
			})
		)
	}

	async memberUpdatedLog(oldMember: GuildMember, newMember: GuildMember) {
		if (!newMember.user) return null

		const changes = compareMemberChanges(oldMember, newMember)
		if (!changes) return null

		return this.tryFetch(() =>
			this.createLogEntry(newMember.guild, this.LOGS[16] as EventActions, 'user', Colors.Yellow, {
				targetUser: { username: newMember.user.username, id: newMember.user.id },
				content: changes
			})
		)
	}
}
