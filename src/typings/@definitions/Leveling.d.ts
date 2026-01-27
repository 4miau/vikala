export interface LevelingConfig {
	xpPerMessage: { min: number; max: number }
	xpCooldown: number
	levelUpChannel?: string
	levelUpMessage: string
	enabledChannels: string[]
	disabledChannels: string[]
	multiplierRoles: { [roleId: string]: number }
}

export interface LevelUpResult {
	leveledUp: boolean
	newLevel: number
	xpGained: number
}

export interface LevelDownResult {
	levelDecreased: boolean
	newLevel: number
	xpRemoved: number
}

export interface UserLevelData {
	userId: string
	guildId: string
	level: number
	xp: number
	totalXp: number
	lastXpGain: Date
	messageCount: number
}

export interface RoleRewardData {
	guildId: string
	level: number
	roleId: string
	isStackable: boolean
}

export interface GuildLevelStats {
	totalUsers: number
	averageLevel: number
	totalMessages: number
}
