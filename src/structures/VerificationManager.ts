import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Guild, GuildMember, TextChannel } from 'discord.js'
import ms from 'ms'

import Vikala from '../client/vikala'
import { Colors } from '../lib/util/Colors'

export interface VerificationConfig {
	enabled: boolean
	channelId: string | null
	messageId: string | null
	roleIds: string[]
	minimumAge: number | null
	customTitle?: string
	customDescription?: string
	customButtonLabel?: string
}

const DEFAULT_CONFIG: VerificationConfig = {
	enabled: false,
	channelId: null,
	messageId: null,
	roleIds: [],
	minimumAge: null,
	customTitle: undefined,
	customDescription: undefined,
	customButtonLabel: undefined
}

export default class VerificationManager {
	private client: Vikala

	constructor(client: Vikala) {
		this.client = client
	}

	public getConfig(guildId: string): VerificationConfig {
		return this.client.settings.get(guildId, 'verification', DEFAULT_CONFIG)
	}

	public buildEmbed(config?: VerificationConfig): EmbedBuilder {
		const title = config?.customTitle || 'Server Verification'
		const description = config?.customDescription || 'Click the **Verify** button below to gain access to this server.'

		return new EmbedBuilder()
			.setColor(Colors.Active)
			.setTitle(title)
			.setDescription(description)
			.setTimestamp()
	}

	public buildRow(config?: VerificationConfig): ActionRowBuilder<ButtonBuilder> {
		const label = config?.customButtonLabel || 'Verify'

		const button = new ButtonBuilder()
			.setCustomId('verify_button')
			.setLabel(label)
			.setStyle(ButtonStyle.Success)
			.setEmoji('✅')

		return new ActionRowBuilder<ButtonBuilder>().addComponents(button)
	}

	public async setup(
    guild: Guild,
    channelId: string,
    roleIds: string[],
    minimumAge: number | null = null,
    customTitle?: string,
    customDescription?: string,
    customButtonLabel?: string
	): Promise<{ success: boolean; error?: string }> {
		const channel = guild.channels.cache.get(channelId) as TextChannel
		if (!channel) return { success: false, error: 'Channel not found.' }

		const config: VerificationConfig = {
			enabled: true,
			channelId: channel.id,
			messageId: null,
			roleIds,
			minimumAge,
			customTitle: customTitle || undefined,
			customDescription: customDescription || undefined,
			customButtonLabel: customButtonLabel || undefined
		}

		const embed = this.buildEmbed(config)
		const row = this.buildRow(config)

		let sentMessage: any
		try {
			sentMessage = await channel.send({ embeds: [embed], components: [row] })
		} catch {
			return { success: false, error: 'Failed to send verification message. Check that the bot has permission to send messages in that channel.' }
		}

		// Clean up the old verification message before saving new config
		const oldConfig = this.getConfig(guild.id)
		if (oldConfig.channelId && oldConfig.messageId) {
			try {
				const oldChannel = guild.channels.cache.get(oldConfig.channelId) as TextChannel
				if (oldChannel) {
					const oldMessage = await oldChannel.messages.fetch(oldConfig.messageId).catch(() => null)
					if (oldMessage) await oldMessage.delete()
				}
			} catch {}
		}

		config.messageId = sentMessage.id

		await this.client.settings.set(guild.id, 'verification', config)
		return { success: true }
	}

	public async handleVerify(interaction: ButtonInteraction): Promise<void> {
		await interaction.deferReply({ flags: ['Ephemeral'] })

		const member = interaction.member as GuildMember
		const config = this.getConfig(interaction.guildId!)

		if (!config.enabled || !config.roleIds?.length) {
			await interaction.editReply({ content: '❌ Verification is not configured for this server.' })
			return
		}

		if (config.roleIds.every(id => member.roles.cache.has(id))) {
			await interaction.editReply({ content: '✅ You are already verified!' })
			return
		}

		if (config.minimumAge) {
			const accountAge = Date.now() - member.user.createdTimestamp
			const requiredMs = ms(`${config.minimumAge}d`)
			if (accountAge < requiredMs) {
				await interaction.editReply({ content: `❌ Your account must be at least **${config.minimumAge} day(s)** old to verify.` })
				return
			}
		}

		try {
			await member.roles.add(config.roleIds)
			await interaction.editReply({ content: '✅ You have been verified! Welcome to the server.' })
		} catch {
			await interaction.editReply({ content: '❌ Failed to assign roles. Please contact a staff member.' })
		}
	}
}
