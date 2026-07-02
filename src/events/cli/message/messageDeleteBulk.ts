import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Collection, Message, Snowflake, TextChannel } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.MessageBulkDelete
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(messages: Collection<Snowflake, Message>) {
		const message = messages.first()
		if (!message || !message.guild) return

		await this.client.events.bulkDeletedMessagesLog(message.guild, (message.channel as TextChannel).name, messages.size)
	}
}
