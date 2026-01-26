import { ApplyOptions } from '@sapphire/decorators'
import { Listener, Events } from '@sapphire/framework'
import { Message } from 'discord.js'

@ApplyOptions<Listener.Options>({ event: Events.MessageCreate })
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(message: Message) {
		if (message.author.bot) return

		const prefix = await this.client.options.fetchPrefix(message)
		const prefixes = Array.isArray(prefix) ? prefix : [prefix]
		const mentionPrefix = new RegExp(`^<@!?${this.client.user?.id}>`)
		const isCommand = prefixes.some((p) => message.content.startsWith(p)) || mentionPrefix.test(message.content) || message.content.startsWith('/')

		if (!message.guild) {
			if (!isCommand) {
				const activeThread = this.client.threads.getActiveThread(message.author.id)
				if (activeThread) await this.client.threads.handleUserMessage(message.author, message)
			}
			return
		}

		if (!isCommand && this.client.threads.isThreadChannel(message.channel.id)) await this.client.threads.handleStaffMessage(message)
		await this.client.automod.processMessage(message)

		try {
			this.client.sheets.handleIsVHS(message)
			this.client.leveling.handleMessageXP(message.member, message.channel)
		} catch {}
	}
}
