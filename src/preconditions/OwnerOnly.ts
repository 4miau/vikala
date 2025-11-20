import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Message } from 'discord.js'
import {
	AllFlowsPrecondition, Identifiers, MessageCommand, Precondition, PreconditionContext, PreconditionResult
} from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'

ApplyOptions<Precondition.Options>({ name: 'OwnerOnly' })
export class OwnerOnly extends Precondition {
	client = this.container.client

	public override messageRun(message: Message<boolean>, command: MessageCommand, context: PreconditionContext): PreconditionResult {
		return this.checkOwner(message.author.id)
	}

	public override chatInputRun(interaction: ChatInputCommandInteraction): AllFlowsPrecondition.Result {
		return this.checkOwner(interaction.user.id)
	}

	public override contextMenuRun(interaction: ContextMenuCommandInteraction): AllFlowsPrecondition.Result {
		return this.checkOwner(interaction.user.id)
	}

	private checkOwner(id: string) { return id === this.client.owner ? this.ok() : this.ownerOnlyError() }

	private ownerOnlyError(): AllFlowsPrecondition.Result {
		return this.error({
			identifier: Identifiers.PreconditionUnavailable,
			message: 'Only the owner can run this command.',
		})
	}
}