import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildChannel } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.ChannelUpdate
})
export class EventListener extends Listener {
	client = this.container.client

	public override async run(oldChannel: GuildChannel, newChannel: GuildChannel) {
		if (oldChannel.partial || newChannel.partial) {
			try {
				oldChannel = await oldChannel.fetch()
				newChannel = await newChannel.fetch()
			} catch {
				return
			}
		}

		await this.client.channelSnapshots.updateSnapshot(newChannel)
		await this.client.events.channelUpdatedLog(oldChannel, newChannel)
	}
}
