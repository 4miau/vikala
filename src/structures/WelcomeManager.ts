import { GuildMember, Guild, TextChannel } from 'discord.js'

import Vikala from '../client/vikala'

interface WelcomeConfig {
	enabled: boolean
	channel: string
	message: string
	dmEnabled: boolean
	dmMessage: string
}

interface GoodbyeConfig {
	enabled: boolean
	channel: string
	message: string
}

export default class WelcomeManager {
	private client: Vikala

	constructor(client: Vikala) {
		this.client = client
	}

	public async _init() {
		const defaultWelcomeConfig: WelcomeConfig = {
			enabled: false,
			channel: null,
			message: 'Welcome {user} to {guild}! We now have {memberCount} members.',
			dmEnabled: false,
			dmMessage: 'Welcome to {guild}! Please read our rules and have a great time!'
		}

		const defaultGoodbyeConfig: GoodbyeConfig = {
			enabled: false,
			channel: null,
			message: '{username} has left {guild}. We now have {memberCount} members.'
		}

		const guilds = this.client.guilds.cache
		for (const [guildId] of guilds) {
			const existingWelcome = this.client.settings.get(guildId, 'welcome', null)
			const existingGoodbye = this.client.settings.get(guildId, 'goodbye', null)

			if (!existingWelcome) {
				await this.client.settings.set(guildId, 'welcome', defaultWelcomeConfig)
			}
			if (!existingGoodbye) {
				await this.client.settings.set(guildId, 'goodbye', defaultGoodbyeConfig)
			}
		}
	}

	public async handleWelcome(member: GuildMember): Promise<void> {
		if (member.user.bot) return

		const config = this.client.settings.get(member.guild.id, 'welcome', {
			enabled: false,
			channel: null,
			message: 'Welcome {user} to {guild}! We now have {memberCount} members.',
			dmEnabled: false,
			dmMessage: 'Welcome to {guild}! Please read our rules and have a great time!'
		}) as WelcomeConfig

		if (!config.enabled) return

		if (config.channel) {
			const welcomeChannel = member.guild.channels.cache.get(config.channel) as TextChannel
			if (welcomeChannel && welcomeChannel.isSendable()) {
				const processedMessage = this.processMessageVariables(config.message, member)
				try {
					await welcomeChannel.send(processedMessage)
				} catch {
					// Failed to send welcome message
				}
			}
		}

		if (config.dmEnabled && config.dmMessage) {
			const processedDmMessage = this.processMessageVariables(config.dmMessage, member)
			try {
				await member.user.send(processedDmMessage)
			} catch {
				// Failed to send DM welcome message
			}
		}
	}

	public async handleGoodbye(member: GuildMember): Promise<void> {
		if (member.user.bot) return

		const config = this.client.settings.get(member.guild.id, 'goodbye', {
			enabled: false,
			channel: null,
			message: '{username} has left {guild}. We now have {memberCount} members.'
		}) as GoodbyeConfig

		if (!config.enabled || !config.channel) return

		const goodbyeChannel = member.guild.channels.cache.get(config.channel) as TextChannel
		if (!goodbyeChannel || !goodbyeChannel.isSendable()) return

		const processedMessage = this.processMessageVariables(config.message, member)

		try {
			await goodbyeChannel.send(processedMessage)
		} catch {
			// Failed to send goodbye message
		}
	}

	private processMessageVariables(message: string, member: GuildMember): string {
		return message
			.replace(/\{user\}/g, member.toString())
			.replace(/\{username\}/g, member.user.username)
			.replace(/\{guild\}/g, member.guild.name)
			.replace(/\{memberCount\}/g, member.guild.memberCount.toString())
	}

	public async getWelcomeConfig(guildId: string): Promise<WelcomeConfig> {
		return this.client.settings.get(guildId, 'welcome', {
			enabled: false,
			channel: null,
			message: 'Welcome {user} to {guild}! We now have {memberCount} members.',
			dmEnabled: false,
			dmMessage: 'Welcome to {guild}! Please read our rules and have a great time!'
		}) as WelcomeConfig
	}

	public async getGoodbyeConfig(guildId: string): Promise<GoodbyeConfig> {
		return this.client.settings.get(guildId, 'goodbye', {
			enabled: false,
			channel: null,
			message: '{username} has left {guild}. We now have {memberCount} members.'
		}) as GoodbyeConfig
	}

	public async setWelcomeEnabled(guildId: string, enabled: boolean): Promise<void> {
		await this.client.settings.set(guildId, 'welcome.enabled', enabled)
	}

	public async setWelcomeChannel(guildId: string, channelId: string | null): Promise<void> {
		await this.client.settings.set(guildId, 'welcome.channel', channelId)
	}

	public async setWelcomeMessage(guildId: string, message: string): Promise<void> {
		await this.client.settings.set(guildId, 'welcome.message', message)
	}

	public async setWelcomeDM(guildId: string, enabled: boolean, message?: string): Promise<void> {
		await this.client.settings.set(guildId, 'welcome.dmEnabled', enabled)
		if (message !== undefined) {
			await this.client.settings.set(guildId, 'welcome.dmMessage', message)
		}
	}

	public async setGoodbyeEnabled(guildId: string, enabled: boolean): Promise<void> {
		await this.client.settings.set(guildId, 'goodbye.enabled', enabled)
	}

	public async setGoodbyeChannel(guildId: string, channelId: string | null): Promise<void> {
		await this.client.settings.set(guildId, 'goodbye.channel', channelId)
	}

	public async setGoodbyeMessage(guildId: string, message: string): Promise<void> {
		await this.client.settings.set(guildId, 'goodbye.message', message)
	}
}
