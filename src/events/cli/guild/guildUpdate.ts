import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Guild } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.GuildUpdate
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(oldGuild: Guild, newGuild: Guild) {
		await this.client.events.guildUpdatedLog(newGuild)
	}
}
