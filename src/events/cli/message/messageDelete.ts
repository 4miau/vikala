import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Message } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.MessageDelete
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(message: Message) {
		if (message.partial) {
			try {
				message = await message.fetch()
			} catch {
				return
			}
		}

		await this.client.events.deletedMessageLog(message)
	}
}
