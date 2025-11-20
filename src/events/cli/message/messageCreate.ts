import { ApplyOptions } from '@sapphire/decorators'
import { Events, Listener } from '@sapphire/framework'
import { Message } from 'discord.js'

ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class EventListener extends Listener {
    client = this.container.client

    public override run(message: Message) {
        this.client.sheets.handleIsVHS(message)
        this.client.leveling.handleMessageXP(message.member, message.channel)
    }
}