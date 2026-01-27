import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js'
import { AllFlowsPrecondition, Identifiers, MessageCommand, Precondition, PreconditionContext, PreconditionResult } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'

ApplyOptions<Precondition.Options>({ name: 'GlobalUserBlacklist', position: 0 })
export class GlobalUserBlacklist extends Precondition {
	client = this.container.client

	public override messageRun(message: Message<boolean>, command: MessageCommand, context: PreconditionContext): PreconditionResult {
		return this.isUserBlacklisted(message)
	}

	public override chatInputRun(interaction: ChatInputCommandInteraction): AllFlowsPrecondition.Result {
		return this.isUserBlacklisted(interaction)
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction): AllFlowsPrecondition.Result {
		return this.isUserBlacklisted(interaction)
	}

	private isUserBlacklisted(m: Message | ChatInputCommandInteraction | ContextMenuCommandInteraction): PreconditionResult {
		const globalBlacklist: string[] = this.client.settings.get('global', 'blacklists.users', [])

		return !globalBlacklist.includes(m.member.user.id) ? this.ok() : this.userBlacklistError()
	}

	private userBlacklistError(): AllFlowsPrecondition.Result {
		return this.error({
			identifier: Identifiers.PreconditionUnavailable,
			message: 'You are globally blacklisted from using this bot command.'
		})
	}
}
