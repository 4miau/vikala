import { EmbedBuilder, TextChannel } from 'discord.js'
import { randomBytes } from 'crypto'
import ms from 'ms'

import Vikala from '../client/vikala'
import Reminder, { IReminder } from '../database/Reminder'
import { Colors } from '../lib/util/Colors'

export default class ReminderManager {
	private readonly client: Vikala

	constructor(client: Vikala) {
		this.client = client
	}

	async _init(): Promise<void> {
		setInterval(() => this._checkReminders().catch(() => {}), ms('30s'))
	}

	private _generateId(): string {
		return randomBytes(3).toString('hex')
	}

	public async create(data: {
		userId: string
		guildId: string | null
		channelId: string | null
		message: string
		triggerAt: Date
		repeat?: string | null
		subscribedFrom?: string | null
	}): Promise<IReminder> {
		return Reminder.create({
			reminderId: this._generateId(),
			userId: data.userId,
			guildId: data.guildId ?? null,
			channelId: data.channelId ?? null,
			message: data.message,
			triggerAt: data.triggerAt,
			createdAt: new Date(),
			repeat: data.repeat ?? null,
			subscribedFrom: data.subscribedFrom ?? null
		})
	}

	public async cancel(reminderId: string, userId: string): Promise<boolean> {
		const result = await Reminder.deleteOne({ reminderId, userId })
		return result.deletedCount > 0
	}

	public async clear(userId: string): Promise<number> {
		const result = await Reminder.deleteMany({ userId })
		return result.deletedCount
	}

	public async list(userId: string): Promise<IReminder[]> {
		return Reminder.find({ userId }).sort({ triggerAt: 1 })
	}

	public async get(reminderId: string): Promise<IReminder | null> {
		return Reminder.findOne({ reminderId })
	}

	public async setRepeat(reminderId: string, userId: string, repeat: string | null): Promise<boolean> {
		const result = await Reminder.updateOne({ reminderId, userId }, { repeat })
		return result.modifiedCount > 0
	}

	public async subscribe(reminderId: string, userId: string, guildId: string | null, channelId: string | null): Promise<IReminder | null> {
		const source = await this.get(reminderId)
		if (!source) return null

		return this.create({
			userId,
			guildId,
			channelId,
			message: source.message,
			triggerAt: source.triggerAt,
			repeat: source.repeat,
			subscribedFrom: source.reminderId
		})
	}

	private async _checkReminders(): Promise<void> {
		const due = await Reminder.find({ triggerAt: { $lte: new Date() } })

		for (const reminder of due) {
			// Update/delete the DB record first to prevent double-firing on the next poll
			if (reminder.repeat && typeof reminder.repeat === 'string') {
				const duration = ms(reminder.repeat as Parameters<typeof ms>[0])
				if (typeof duration === 'number' && duration > 0) {
					await Reminder.updateOne({ _id: reminder._id }, { triggerAt: new Date(Date.now() + duration) })
				} else {
					await Reminder.deleteOne({ _id: reminder._id })
				}
			} else {
				await Reminder.deleteOne({ _id: reminder._id })
			}

			this._fireReminder(reminder).catch(() => {})
		}
	}

	private async _fireReminder(reminder: IReminder): Promise<void> {
		try {
			if (reminder.channelId) {
				try {
					const channel = (this.client.channels.cache.get(reminder.channelId) ??
						(await this.client.channels.fetch(reminder.channelId).catch(() => null))) as TextChannel | null

					if (channel?.isSendable()) {
						await channel.send({ content: `<@${reminder.userId}>`, embeds: [this._buildEmbed(reminder, false)] })
						return
					}
				} catch {}
			}

			// DM fallback
			const user = await this.client.users.fetch(reminder.userId)
			await user.send({ embeds: [this._buildEmbed(reminder, true)] })
		} catch {
			// Unable to deliver via channel or DM — silently drop
		}
	}

	private _buildEmbed(reminder: IReminder, isDM: boolean): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(Colors.HighlightYellow)
			.setTitle('⏰ Reminder')
			.setDescription(reminder.message)
			.setFooter({ text: `ID: ${reminder.reminderId}` })
			.setTimestamp()

		if (isDM && reminder.guildId && reminder.channelId) {
			const guild = this.client.guilds.cache.get(reminder.guildId)
			const channel = guild?.channels.cache.get(reminder.channelId)
			embed.addFields({ name: 'Set in', value: `**${guild?.name ?? 'Unknown Server'}** → #${channel?.name ?? 'unknown-channel'}` })
		}

		if (reminder.repeat) {
			embed.addFields({ name: 'Repeats every', value: reminder.repeat, inline: true })
		}

		return embed
	}
}
