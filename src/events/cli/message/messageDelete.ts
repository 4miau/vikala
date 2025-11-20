import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Message } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.MessageDelete
})
export class EventListener extends Listener {
    client = this.container.client

    public override async run(message: Message) {
        await this.client.events.deletedMessageLog(message)
    }
}