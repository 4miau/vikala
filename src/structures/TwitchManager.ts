import { EmbedBuilder, Guild, Message } from 'discord.js'
import ms from 'ms'

import Vikala from '../client/vikala'
import { defaultStreamMessage, twitchApi, twitchApi2 } from '../lib/util/constants'
import { envs } from '../lib/util/environmentVariables'
import { Streamer, TwitchStream, TwitchUser, TwitchVOD, TwitchGame } from '../typings/@definitions/Twitch'
import { arrayEmpty } from 'miau-utilities'
import { parseOfflineEmbed, parseOnlineEmbed, parseStreamMessage, createStreamButton, createVODButton } from '../lib/util/twitchUtil'

export default class TwitchManager {
	private accessToken: string
	private tokenTimeout: NodeJS.Timeout | null = null
	public nextPoll: number = 0
	private readonly client: Vikala

	public constructor(client: Vikala) {
		this.client = client
	}

	async _init(): Promise<void> {
		try {
			await this.manageTokens()

			setInterval(() => this.postStreams().catch(() => {}), ms('5m'))
			setInterval(() => this.checkStreamersOffline().catch(() => {}), ms('10m'))
			this.nextPoll = Date.now() + ms('5m')
			setInterval(() => this.manageTokens().catch(() => {}), ms('1h'))
			setInterval(() => this.updateAllStreamers().catch(() => {}), ms('1d'))
		} catch (err) {
			throw new Error(`Failed to initialize Twitch Manager: ${err}`)
		}
	}

	private async manageTokens(): Promise<void> {
		const tokenRequest = {
			method: 'POST' as const,
			url: `${twitchApi}/token`,
			params: {
				client_id: envs.twitchClientId,
				client_secret: envs.twitchClientSecret,
				grant_type: 'client_credentials'
			}
		}

		try {
			const response = await this.client.api.set(tokenRequest).call()
			this.accessToken = response.access_token

			if (this.tokenTimeout) clearTimeout(this.tokenTimeout)
			this.tokenTimeout = setTimeout(() => this.manageTokens(), ms('1h'))
		} catch (error) {
			throw new Error(`Failed to refresh Twitch access token: ${error}`)
		}
	}

	private createApiRequest(endpoint: string, params: Record<string, any> = {}) {
		return {
			method: 'GET' as const,
			url: `${twitchApi2}/${endpoint}`,
			headers: {
				'client-id': envs.twitchClientId,
				Authorization: `Bearer ${this.accessToken}`
			},
			params
		}
	}

	async getStream(name: string): Promise<TwitchStream | null> {
		try {
			const request = this.createApiRequest('streams', { user_login: name })
			const response = await this.client.api.set(request).call()
			return response.data[0] || null
		} catch (error) {
			throw new Error(`Failed to get stream for '${name}': ${error}`)
		}
	}

	async getVOD(streamer: Streamer): Promise<TwitchVOD | null> {
		try {
			const request = this.createApiRequest('videos', { user_id: streamer.id })
			const response = await this.client.api.set(request).call()
			const videos = response.data as TwitchVOD[]
			return videos.find((vod) => vod.stream_id === streamer.stream?.id) || null
		} catch (error) {
			throw new Error(`Failed to get VOD for streamer '${streamer.name}': ${error}`)
		}
	}

	async getGame(gameId: string): Promise<TwitchGame> {
		if (!gameId) return null

		try {
			const request = this.createApiRequest('games', { id: gameId })
			const response = await this.client.api.set(request).call()
			return response.data[0] || null
		} catch {
			return null
		}
	}

	async getTwitchUser(name: string): Promise<TwitchUser | null> {
		try {
			const request = this.createApiRequest('search/channels', { query: name })
			const response = await this.client.api.set(request).call()
			return response.data.find((user: TwitchUser) => user.broadcaster_login.toLowerCase() === name.toLowerCase()) || null
		} catch (error) {
			throw new Error(`Failed to get streamer '${name}': ${error}`)
		}
	}

	async getStreamer(name: string): Promise<Streamer | null> {
		const streamer = await this.getTwitchUser(name)
		if (!streamer) return null

		for (const guild of this.client.guilds.cache.values()) {
			const streamers = this.listStreamers(guild)
			const foundStreamer = streamers.find((s) => s.id === streamer.id)
			if (foundStreamer) return foundStreamer
		}

		return null
	}

	async addStreamer(name: string, guild: string | Guild, channel?: string, msg?: string): Promise<boolean> {
		if (!name?.trim()) return false

		const streamer = await this.getTwitchUser(name.trim())
		if (!streamer) return false

		const streamers = this.listStreamers(guild)
		if (streamers.some((s) => s.id === streamer.id)) return false

		const newStreamer: Streamer = {
			id: streamer.id,
			name: streamer.broadcaster_login,
			message: msg || defaultStreamMessage,
			channel: channel || null,
			guildId: typeof guild === 'string' ? guild : guild.id,
			embed: true,
			posted: false,
			postedMessageId: null,
			lastPosted: null,
			stream: null,
			lastStreamThumbnail: null
		}

		streamers.push(newStreamer)
		this.client.settings.set(guild, 'streamers', streamers)
		return true
	}

	async removeStreamer(name: string, guild: string | Guild): Promise<boolean> {
		if (!name?.trim()) return false

		const streamer = await this.getTwitchUser(name.trim())
		if (!streamer) return false

		const streamers = this.listStreamers(guild)
		const filteredStreamers = streamers.filter((s) => s.id !== streamer.id)

		if (filteredStreamers.length === streamers.length) return false

		this.client.settings.set(guild, 'streamers', filteredStreamers)
		return true
	}

	moveStreamer(name: string, guild: string | Guild, channel: string): boolean {
		if (!name?.trim() || !channel?.trim()) return false
		return this.modifyStreamer(name, guild, { channel })
	}

	modifyStreamer(name: string, guild: string | Guild, prop: Partial<Streamer>): boolean {
		if (!name?.trim()) return false

		const streamers = this.listStreamers(guild)
		const streamerIndex = streamers.findIndex((s) => s.name.toLowerCase() === name.toLowerCase())

		if (streamerIndex === -1) return false

		const updatedProp = { ...prop }
		if (updatedProp.message === 'none') updatedProp.message = null
		if (updatedProp.message === 'default') updatedProp.message = defaultStreamMessage

		streamers[streamerIndex] = { ...streamers[streamerIndex], ...updatedProp }
		this.client.settings.set(guild, 'streamers', streamers)
		return true
	}

	async updateAllStreamers(): Promise<void> {
		const guilds = this.client.guilds.cache.values()

		for (const guild of guilds) {
			const streamers = this.listStreamers(guild)
			if (arrayEmpty(streamers)) continue

			try {
				const batchSize = 10
				for (let i = 0; i < streamers.length; i += batchSize) {
					const batch = streamers.slice(i, i + batchSize)
					await Promise.allSettled(
						batch.map(async (streamer) => {
							try {
								const request = this.createApiRequest('users', { id: streamer.id })
								const response = await this.client.api.set(request).call()
								const userData = response.data[0]

								if (!userData) {
									streamer.id = null
								} else if (streamer.name !== userData.login) {
									streamer.name = userData.login
								}
							} catch {
								// Failed to update streamer
							}
						})
					)
				}

				this.client.settings.set(guild, 'streamers', streamers)
			} catch {
				// Failed to update streamers for guild
			}
		}
	}

	async postStreams(): Promise<void> {
		this.nextPoll = Date.now() + ms('5m')
		const guilds = this.client.guilds.cache.values()

		for (const guild of guilds) {
			const streamers = this.listStreamers(guild)
			if (arrayEmpty(streamers)) continue

			for (const streamer of streamers) {
				try {
					if (streamer.posted || (streamer.lastPosted && Date.now() - streamer.lastPosted < ms('5m'))) continue

					const stream = await this.getStream(streamer.name)
					if (!stream) continue

					const channel = guild.channels.cache.get(streamer.channel)
					if (!channel?.isSendable()) continue

					const messageContent = parseStreamMessage(streamer.message, stream)
					const game = stream.game_id ? await this.getGame(stream.game_id) : null
					const embed = streamer.embed ? parseOnlineEmbed(stream, game) : null
					const components = embed ? [createStreamButton(stream)] : []
					const payload = {
						content: messageContent || null,
						embeds: embed ? [embed] : [],
						components: components
					}

					const notification = await channel.send(payload)
					const thumbnailUrl = stream.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080')
					const updateData: Partial<Streamer> = {
						posted: true,
						postedMessageId: notification.id,
						lastPosted: Date.now(),
						stream,
						lastStreamThumbnail: thumbnailUrl
					}

					this.modifyStreamer(streamer.name, guild, updateData)
				} catch {
					// Error posting live notification
				}
			}
		}
	}

	async checkStreamersOffline(): Promise<void> {
		const guilds = this.client.guilds.cache.values()

		for (const guild of guilds) {
			const streamers = this.listStreamers(guild)
			if (arrayEmpty(streamers)) continue

			for (const streamer of streamers) {
				if (!streamer.posted) continue

				try {
					const stream = await this.getStream(streamer.name)
					if (stream) continue

					const vod = await this.getVOD(streamer)
					if (!vod) {
						this.modifyStreamer(streamer.name, guild, { posted: false })
						continue
					}

					const channel = guild.channels.cache.get(streamer.channel)
					if (!channel?.isSendable()) continue

					const postedMessage = await channel.messages.fetch({
						message: streamer.postedMessageId,
						force: true
					})

					if (!postedMessage) {
						this.modifyStreamer(streamer.name, guild, { posted: false })
						continue
					}

					const shouldShowEmbed = streamer.embed || postedMessage.embeds.length > 0
					const game = streamer.stream?.game_id ? await this.getGame(streamer.stream.game_id) : null
					const embed = shouldShowEmbed ? parseOfflineEmbed(streamer, vod, game) : null
					const components = embed ? [createVODButton(vod)] : []

					await postedMessage.edit({
						content: `**${streamer.name}** was live`,
						embeds: embed ? [embed] : [],
						components: components
					})

					this.modifyStreamer(streamer.name, guild, { posted: false })
				} catch {
					this.modifyStreamer(streamer.name, guild, { posted: false })
				}
			}
		}
	}

	// HELPERS

	async getStreamerStatus(name: string): Promise<{ is_live: boolean; msg: Message<boolean>; stream?: TwitchStream | null }> {
		const stream = await this.getStream(name)
		if (!stream) return { is_live: false, msg: null, stream: null }

		const streamer = await this.getStreamer(name)

		const msg = stream ? await this.fetchPostedMessage(streamer, this.client.guilds.cache.get(streamer.guildId)) : null
		return { is_live: !!stream, msg: msg, stream }
	}

	async fetchPostedMessage(streamer: Streamer, guild: Guild): Promise<Message | null> {
		if (!streamer.postedMessageId) return null
		const channel = guild.channels.cache.get(streamer.channel)
		if (!channel?.isSendable()) return null
		try {
			return await channel.messages.fetch({ message: streamer.postedMessageId, force: true })
		} catch {
			this.modifyStreamer(streamer.name, guild, { posted: false, postedMessageId: null })
			return null
		}
	}

	listStreamersEmbed(guild: string | Guild): EmbedBuilder | null {
		const streamers = this.listStreamers(guild)
		if (arrayEmpty(streamers)) return null

		const description = streamers
			.map((s) => `:red_circle: [${s.name}](https://twitch.tv/${s.name}) (${s.id}) ${s.channel ? `<#${s.channel}>` : 'No channel set'}`)
			.join('\n')

		return new EmbedBuilder()
			.setTitle('Tracked Twitch Streamers')
			.setDescription(description)
	}

	checkForPremium(guild: Guild): boolean {
		return this.client.settings.get(guild, 'premium', false)
	}

	async isLive(name: string): Promise<boolean> {
		const stream = await this.getStream(name)
		return !!stream
	}

	listStreamers(guild: string | Guild): Streamer[] {
		return this.client.settings.get(guild, 'streamers', [])
	}
}
