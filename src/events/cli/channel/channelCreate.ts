import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildChannel } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.ChannelCreate
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(channel: GuildChannel) {
		await this.client.channelSnapshots.updateSnapshot(channel)
		await this.client.events.channelCreatedLog(channel)
	}
}
