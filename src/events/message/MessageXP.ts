import { ApplyOptions } from '@sapphire/decorators'
import { Events, Listener } from '@sapphire/framework'
import { Message } from 'discord.js'

@ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class EventListener extends Listener {
    public override run(message: Message) {
        const { client } = this.container

        client.leveling.handleMessageXP(message.member, message.channel)
    }
}