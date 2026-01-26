import { GuildMember, Guild, Message } from 'discord.js'

import Case, { ICase } from '../database/Case'
import Vikala from '../client/vikala'

declare type extrasOptions = {
	actionDuration?: Date
	actionComplete?: boolean
}

declare type CaseData = {
	message?: string
	action: string
	reason?: string
	target?: GuildMember
	mod?: GuildMember
	extras?: extrasOptions
}

export default class ModLogger {
	private client: Vikala
	MOD_ACTIONS = {
		1: 'BAN',
		2: 'UNBAN',
		3: 'SOFTBAN',
		4: 'KICK',
		5: 'MUTE',
		6: 'UNMUTE',
		7: 'WARN',
		8: 'PARDON'
	}

	constructor(client: Vikala) {
		this.client = client
	}

	getLatestCaseId(guild: Guild) {
		return this.client.settings.get(guild, 'casesTotal', 1)
	}

	async getCase(guild: Guild, caseId: number) {
		return Case.findOne({ guildId: guild.id, caseId: caseId }) as Promise<ICase>
	}

	async getLatestCases(guild: Guild, limit: number = 10): Promise<ICase[]> {
		return Case.find({ guildId: guild.id }).sort({ caseId: -1 }).limit(limit) as Promise<ICase[]>
	}

	async getCasesByUser(guild: Guild, userId: string, limit: number = 15): Promise<ICase[]> {
		return Case.find({ guildId: guild.id, targetId: userId }).sort({ caseId: -1 }).limit(limit) as Promise<ICase[]>
	}

	formatCase(caseData: ICase): string {
		const emoji = this.getEmoji(caseData.action as ModActions)
		const action = this.getPhrase(caseData.action as ModActions)
		const reason = caseData.extras?.reason || 'No reason provided'

		let logMessage = `\`[Case ${caseData.caseId}]\` ${emoji} **${caseData.targetUsername}** was ${action}`

		if (caseData.modUsername) logMessage += ` by **${caseData.modUsername}**`
		if (reason && reason !== 'No reason provided') logMessage += ` - ${reason}`

		return logMessage
	}

	async createCase(guild: Guild, data: Partial<CaseData>) {
		if (!data.action || !data.message || !data.target) return false

		const caseId = await this.client.settings.getNextCaseId(guild)

		const testCase = await new Case({
			id: (await Case.countDocuments()) + 1,
			guildId: guild.id,
			messageId: data?.message,
			caseId: caseId,
			action: data.action,
			targetId: data.target?.id,
			targetUsername: data.target?.user.username,
			modId: data.mod?.id,
			modUsername: data.mod?.user.username,
			extras: {
				reason: data?.reason,
				actionDuration: data?.extras?.actionDuration,
				actionComplete: data?.extras?.actionComplete
			}
		}).save()

		return testCase.errors ? false : true
	}

	formatLog(modCase: ICase) {
		const action = this.MOD_ACTIONS[modCase.action] as ModActions

		return (
			`\`${modCase.createdAt}\` \`${modCase.caseId}\` ` +
			`${this.getEmoji(action)} **${modCase.modUsername}** ` +
			`${this.getPhrase(action)} **${modCase.targetUsername}** (\`${modCase.targetId}\`)\n` +
			`\`[ Reason ]\` ${modCase.extras.reason}`
		)
	}

	getEmoji(action: ModActions) {
		switch (action) {
			case 'BAN':
				return '🔨'
			case 'UNBAN':
				return '🔧'
			case 'SOFTBAN':
				return '⏰'
			case 'KICK':
				return '👢'
			case 'MUTE':
				return '🔇'
			case 'UNMUTE':
				return '🔊'
			case 'WARN':
				return '🚩'
			case 'PARDON':
				return '🏳️'
		}
	}

	getPhrase(action: ModActions) {
		switch (action) {
			case 'BAN':
				return 'banned'
			case 'UNBAN':
				return 'unbanned'
			case 'SOFTBAN':
				return 'softbanned'
			case 'KICK':
				return 'kicked'
			case 'MUTE':
				return 'muted'
			case 'UNMUTE':
				return 'unmuted'
			case 'WARN':
				return 'warned'
			case 'PARDON':
				return 'pardoned'
		}
	}
}
