import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, MessageReaction, User } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.MessageReactionRemove
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(reaction: MessageReaction, user: User) {
		if (reaction.partial) {
			try {
				reaction = await reaction.fetch()
			} catch {
				return
			}
		}

		if (!reaction.message.guild) return

		await this.client.roleGroups.handleReactionRemove(reaction, user)
	}
}
