import { EmbedBuilder, Guild } from 'discord.js'
import ms from 'ms'

import Vikala from '../client/vikala'
import { youtubeApi, defaultVideoMessage } from '../lib/util/constants'
import { envs } from '../lib/util/environmentVariables'
import { arrayEmpty } from 'miau-utilities'
import { parseVideoEmbed, parseVideoMessage, createVideoButton } from '../lib/util/youtubeUtil'
import { Colors } from '../lib/util/Colors'

export default class YouTubeManager {
	private readonly client: Vikala
	public nextPoll: number = 0

	public constructor(client: Vikala) {
		this.client = client
	}

	async _init(): Promise<void> {
		try {
			setInterval(() => this.postNewVideos().catch(() => {}), ms('5m'))
			this.nextPoll = Date.now() + ms('5m')
		} catch (err) {
			throw new Error(`Failed to initialize YouTube Manager: ${err}`)
		}
	}

	private createApiRequest(endpoint: string, params: Record<string, any> = {}) {
		return {
			method: 'GET' as const,
			url: `${youtubeApi}/${endpoint}`,
			params: {
				...params,
				key: envs.GOOGLE_API_KEY
			}
		}
	}

	async getChannelInfo(handle: string): Promise<YouTubeChannelInfo | null> {
		const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`

		try {
			const request = this.createApiRequest('channels', {
				part: 'snippet,contentDetails',
				forHandle: normalizedHandle
			})
			const response = await this.client.api.set(request).call()
			return response.items?.[0] || null
		} catch (error) {
			throw new Error(`Failed to get YouTube channel for '${handle}': ${error}`)
		}
	}

	async getRecentVideos(uploadsPlaylistId: string, maxResults = 10): Promise<YouTubeVideoSnippet[]> {
		try {
			const request = this.createApiRequest('playlistItems', {
				part: 'snippet',
				playlistId: uploadsPlaylistId,
				maxResults
			})
			const response = await this.client.api.set(request).call()
			return response.items?.map((item: any) => item.snippet) ?? []
		} catch {
			return []
		}
	}

	async checkVideoTypes(videoIds: string[]): Promise<Map<string, string>> {
		if (videoIds.length === 0) return new Map()

		try {
			const request = this.createApiRequest('videos', {
				part: 'liveStreamingDetails',
				id: videoIds.join(',')
			})
			const response = await this.client.api.set(request).call()

			const typeMap = new Map<string, string>()
			for (const item of response.items || []) {
				// liveBroadcastContent values: 'none' (regular video), 'live', 'upcoming', 'completed'
				const broadcastType = item.liveStreamingDetails?.liveBroadcastContent || 'none'
				typeMap.set(item.id, broadcastType)
			}
			return typeMap
		} catch {
			// On error, assume all videos are regular videos
			return new Map(videoIds.map((id) => [id, 'none']))
		}
	}

	async addChannel(handle: string, guild: string | Guild, channelId: string, msg?: string): Promise<boolean> {
		if (!handle?.trim()) return false

		const normalized = handle.trim().replace(/^@/, '')
		const info = await this.getChannelInfo(normalized)
		if (!info) return false

		const channels = this.listChannels(guild)
		if (channels.some((c) => c.id === info.id)) return false

		const newChannel: YouTubeChannel = {
			id: info.id,
			handle: normalized,
			name: info.snippet.title,
			thumbnailUrl: info.snippet.thumbnails.high?.url ?? info.snippet.thumbnails.default?.url ?? null,
			uploadsPlaylistId: info.contentDetails.relatedPlaylists.uploads,
			message: msg || defaultVideoMessage,
			channel: channelId,
			guildId: typeof guild === 'string' ? guild : guild.id,
			embed: true,
			includeStreams: false,
			lastVideoId: null,
			lastPosted: null
		}

		channels.push(newChannel)
		this.client.settings.set(guild, 'youtubeChannels', channels)
		return true
	}

	async removeChannel(handle: string, guild: string | Guild): Promise<boolean> {
		if (!handle?.trim()) return false

		const normalized = handle.trim().replace(/^@/, '')
		const channels = this.listChannels(guild)
		const filtered = channels.filter((c) => c.handle.toLowerCase() !== normalized.toLowerCase())

		if (filtered.length === channels.length) return false

		this.client.settings.set(guild, 'youtubeChannels', filtered)
		return true
	}

	moveChannel(handle: string, guild: string | Guild, channelId: string): boolean {
		return this.modifyChannel(handle, guild, { channel: channelId })
	}

	modifyChannel(handle: string, guild: string | Guild, prop: Partial<YouTubeChannel>): boolean {
		if (!handle?.trim()) return false

		const normalized = handle.trim().replace(/^@/, '')
		const channels = this.listChannels(guild)
		const index = channels.findIndex((c) => c.handle.toLowerCase() === normalized.toLowerCase())

		if (index === -1) return false

		const updatedProp = { ...prop }
		if (updatedProp.message === 'none') updatedProp.message = null
		if (updatedProp.message === 'default') updatedProp.message = defaultVideoMessage

		channels[index] = { ...channels[index], ...updatedProp }
		this.client.settings.set(guild, 'youtubeChannels', channels)
		return true
	}

	async postNewVideos(): Promise<void> {
		this.nextPoll = Date.now() + ms('5m')
		const guilds = this.client.guilds.cache.values()

		for (const guild of guilds) {
			const channels = this.listChannels(guild)
			if (arrayEmpty(channels)) continue

			for (const ytChannel of channels) {
				try {
					const videos = await this.getRecentVideos(ytChannel.uploadsPlaylistId)
					if (arrayEmpty(videos)) continue

					if (!ytChannel.lastVideoId) {
						this.modifyChannel(ytChannel.handle, guild, { lastVideoId: videos[0].resourceId.videoId })
						continue
					}

					const lastIndex = videos.findIndex((v) => v.resourceId.videoId === ytChannel.lastVideoId)
					let newVideos = lastIndex === -1 ? [videos[0]] : videos.slice(0, lastIndex)
					if (arrayEmpty(newVideos)) continue

					if (!ytChannel.includeStreams) {
						const videoIds = newVideos.map((v) => v.resourceId.videoId)
						const videoTypes = await this.checkVideoTypes(videoIds)
						newVideos = newVideos.filter((v) => videoTypes.get(v.resourceId.videoId) === 'none')

						if (arrayEmpty(newVideos)) continue
						}
							const discordChannel = guild.channels.cache.get(ytChannel.channel)
							if (!discordChannel?.isSendable()) continue

							// Post oldest-first so notifications appear in chronological order
							for (const video of newVideos.reverse()) {
								const videoId = video.resourceId.videoId
								const messageContent = ytChannel.message ? parseVideoMessage(ytChannel.message, ytChannel.name, video) : null
								const embed = ytChannel.embed ? parseVideoEmbed(ytChannel, video) : null
								const components = embed ? [createVideoButton(videoId)] : []

								await discordChannel.send({
									content: messageContent || null,
									embeds: embed ? [embed] : [],
									components
								})
							}

							this.modifyChannel(ytChannel.handle, guild, {
								lastVideoId: newVideos[newVideos.length - 1].resourceId.videoId,
								lastPosted: Date.now()
							})
						} catch {
							// Failed to post video notification
						}
					}
		}
	}

	listChannels(guild: string | Guild): YouTubeChannel[] {
		return this.client.settings.get(guild, 'youtubeChannels', [])
	}

	listChannelsEmbed(guild: string | Guild): EmbedBuilder | null {
		const channels = this.listChannels(guild)
		if (arrayEmpty(channels)) return null

		const description = channels
			.map((c) => `[${c.name}](https://youtube.com/@${c.handle}) ${c.channel ? `<#${c.channel}>` : 'No channel set'}`)
			.join('\n')

		return new EmbedBuilder()
			.setTitle('Tracked YouTube Channels')
			.setDescription(description)
			.setColor(Colors.Red)
	}
}