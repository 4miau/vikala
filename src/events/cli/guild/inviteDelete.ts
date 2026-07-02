import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Invite, Guild } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.InviteDelete
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(invite: Invite) {
		if (!invite.guild) return
		await this.client.events.inviteDeletedLog(invite.guild as Guild, invite.code)
	}
}
