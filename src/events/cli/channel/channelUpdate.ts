import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildChannel } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.ChannelUpdate
})
export class EventListener extends Listener {
    client = this.container.client

    public override async run(oldChannel: GuildChannel, newChannel: GuildChannel) {
        await this.client.events.channelUpdatedLog(oldChannel, newChannel)
    }
}