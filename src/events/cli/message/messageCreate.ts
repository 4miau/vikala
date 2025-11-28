import { ApplyOptions } from '@sapphire/decorators'
import { Listener, Events } from '@sapphire/framework'
import { Message } from 'discord.js'

@ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class EventListener extends Listener {
    private client = this.container.client

    public override async run(message: Message) {
        await this.client.automod.processMessage(message)
        try {
            this.client.sheets.handleIsVHS(message)
            this.client.leveling.handleMessageXP(message.member, message.channel)
        } catch {
        }
    }
}