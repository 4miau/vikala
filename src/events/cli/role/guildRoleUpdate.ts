import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Role } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.GuildRoleUpdate
})
export class EventListener extends Listener {
	client = this.container.client

	public override async run(oldRole: Role, newRole: Role) {
		await this.client.events.roleUpdatedLog(oldRole, newRole)
	}
}
