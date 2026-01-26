import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'
import { Guild, GuildMember } from 'discord.js'

import Task from '../../lib/mods/Task'

@ApplyOptions<Piece.Options>({ name: 'getjoinposition' })
export default class GetJoinposition extends Task {
	client = this.container.client

	exec(member: GuildMember) {
		const members = member.guild.members.cache.sort((a, b) => a.joinedTimestamp! - b.joinedTimestamp!).map((gm) => gm)
		return members.findIndex((m) => m.id === member.id) + 1
	}
}
