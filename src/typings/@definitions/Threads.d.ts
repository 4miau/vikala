export interface ThreadConfig {
	categoryId?: string | null
	transcriptChannel?: string | null
	staffRoles?: string[]
	anonymous?: boolean
	blacklist?: string[]
	counter?: number
	setupMessageId?: string | null
	setupChannelId?: string | null
}
