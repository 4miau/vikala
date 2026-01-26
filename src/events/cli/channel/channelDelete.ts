import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildChannel } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.ChannelDelete
})
export class EventListener extends Listener {
	client = this.container.client

	public override async run(channel: GuildChannel) {
		if (channel.partial) {
			try {
				channel = await channel.fetch()
			} catch {}
		}

		await this.client.channelSnapshots.markDeleted(channel.id, channel.guild.id)
		await this.client.events.channelDeletedLog(channel)
		await this.client.threads.handleChannelDeleted(channel.guild.id, channel.id)
	}
}
