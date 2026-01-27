import { GuildChannel, ChannelType } from 'discord.js'
import Vikala from '../client/vikala'
import ChannelSnapshotModel, { IChannelSnapshot } from '../database/ChannelSnapshot'

export default class ChannelSnapshotManager {
	protected client: Vikala

	constructor(cli: Vikala) {
		this.client = cli
	}

	public async _init() {
		await this.snapshotExistingChannels()
	}

	private async snapshotExistingChannels() {
		let channelCount = 0

		for (const guild of this.client.guilds.cache.values()) {
			for (const channel of guild.channels.cache.values()) {
				if (channel.isThread()) continue
				await this.updateSnapshot(channel as GuildChannel)
				channelCount++
			}
		}

		console.log(`[ChannelSnapshotManager] Snapshotted ${channelCount} channels across ${this.client.guilds.cache.size} guilds`)
	}

	public async updateSnapshot(channel: GuildChannel): Promise<void> {
		try {
			const snapshotData = {
				channelId: channel.id,
				guildId: channel.guild.id,
				name: channel.name,
				type: channel.type,
				categoryId: channel.parentId || undefined,
				topic: 'topic' in channel ? channel.topic || undefined : undefined,
				position: channel.position,
				nsfw: 'nsfw' in channel ? channel.nsfw : false,
				lastSeen: new Date()
			}

			await ChannelSnapshotModel.updateOne(
				{ channelId: channel.id, guildId: channel.guild.id },
				{ $set: snapshotData, $setOnInsert: { createdAt: new Date() } },
				{ upsert: true }
			)
		} catch (error) {
			console.error(`[ChannelSnapshotManager] Failed to snapshot channel ${channel.id}:`, error)
		}
	}

	public async markDeleted(channelId: string, guildId: string): Promise<void> {
		try {
			await ChannelSnapshotModel.updateOne({ channelId, guildId }, { $set: { deletedAt: new Date() } })
		} catch (error) {
			console.error(`[ChannelSnapshotManager] Failed to mark channel ${channelId} as deleted:`, error)
		}
	}

	public async getSnapshot(channelId: string): Promise<IChannelSnapshot | null> {
		try {
			return await ChannelSnapshotModel.findOne({ channelId })
		} catch (error) {
			console.error(`[ChannelSnapshotManager] Failed to retrieve snapshot for ${channelId}:`, error)
			return null
		}
	}

	public async getChannelName(channelId: string, guildId?: string): Promise<string> {
		const cachedChannel = this.client.channels.cache.get(channelId)
		if (cachedChannel && 'name' in cachedChannel) return cachedChannel.name

		const snapshot = await this.getSnapshot(channelId)
		if (snapshot) return snapshot.name

		return 'Unknown Channel'
	}

	public async getChannelInfo(channelId: string): Promise<{ name: string; type: string; isDeleted: boolean }> {
		const cachedChannel = this.client.channels.cache.get(channelId)
		if (cachedChannel && 'name' in cachedChannel) {
			return {
				name: cachedChannel.name,
				type: this.getChannelTypeString(cachedChannel.type),
				isDeleted: false
			}
		}

		const snapshot = await this.getSnapshot(channelId)
		if (snapshot) {
			return {
				name: snapshot.name,
				type: this.getChannelTypeString(snapshot.type),
				isDeleted: !!snapshot.deletedAt
			}
		}

		return {
			name: 'Unknown Channel',
			type: 'Unknown',
			isDeleted: true
		}
	}

	private getChannelTypeString(type: number): string {
		const typeMap: { [key: number]: string } = {
			[ChannelType.GuildText]: 'Text',
			[ChannelType.GuildVoice]: 'Voice',
			[ChannelType.GuildCategory]: 'Category',
			[ChannelType.GuildAnnouncement]: 'Announcement',
			[ChannelType.AnnouncementThread]: 'Thread',
			[ChannelType.PublicThread]: 'Thread',
			[ChannelType.PrivateThread]: 'Thread',
			[ChannelType.GuildStageVoice]: 'Stage',
			[ChannelType.GuildForum]: 'Forum',
			[ChannelType.GuildMedia]: 'Media'
		}
		return typeMap[type] || 'Unknown'
	}

	public async cleanupOldSnapshots(daysOld: number = 90): Promise<number> {
		try {
			const cutoffDate = new Date()
			cutoffDate.setDate(cutoffDate.getDate() - daysOld)

			const result = await ChannelSnapshotModel.deleteMany({ deletedAt: { $lt: cutoffDate, $ne: null } })
			console.log(`[ChannelSnapshotManager] Cleaned up ${result.deletedCount} old channel snapshots`)
			return result.deletedCount || 0
		} catch (error) {
			console.error('[ChannelSnapshotManager] Failed to cleanup old snapshots:', error)
			return 0
		}
	}
}
