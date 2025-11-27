import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Message } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.MessageUpdate
})
export class EventListener extends Listener {
    client = this.container.client

    public override async run(oldMessage: Message, newMessage: Message) {
        if (oldMessage.partial || newMessage.partial) {
            try {
                oldMessage = await oldMessage.fetch()
                newMessage = await newMessage.fetch()
            }
            catch { return }
        }

        await this.client.events.editedMessageLog(oldMessage, newMessage)
    }
}