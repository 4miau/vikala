import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildMember } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.GuildMemberUpdate
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(oldMember: GuildMember, newMember: GuildMember) {
		await this.client.events.memberUpdatedLog(oldMember, newMember)
	}
}
