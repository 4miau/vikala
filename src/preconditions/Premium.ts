import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Guild, Message } from 'discord.js'
import {
    AllFlowsPrecondition, Identifiers, MessageCommand, Precondition, PreconditionContext, PreconditionResult
} from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'

ApplyOptions<Precondition.Options>({ name: 'Premium', position: 0 })
export class Premium extends Precondition {
    client = this.container.client

    public override messageRun(message: Message<boolean>, command: MessageCommand, context: PreconditionContext): PreconditionResult {
        return this.isPremiumGuild(message.guild)
    }

    public override chatInputRun(interaction: ChatInputCommandInteraction): AllFlowsPrecondition.Result {
        return this.isPremiumGuild(interaction.guild)
    }

    public override contextMenuRun(interaction: ContextMenuCommandInteraction): AllFlowsPrecondition.Result {
        return this.isPremiumGuild(interaction.guild)
    }

    private isPremiumGuild(guild: Guild): PreconditionResult {
        const hasPremium = this.client.settings.get(guild, 'premium', false)
        return hasPremium ? this.ok() : this.premiumError()
    }

    private premiumError(): AllFlowsPrecondition.Result {
        return this.error({
            identifier: Identifiers.PreconditionUnavailable,
            message: 'Server does not have premium features enabled.',
        })
    }
}