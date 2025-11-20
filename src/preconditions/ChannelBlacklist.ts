import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, Guild, Message } from 'discord.js'
import {
    AllFlowsPrecondition, Identifiers, MessageCommand, Precondition, PreconditionContext, PreconditionResult
} from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'

ApplyOptions<Precondition.Options>({ name: 'ChannelBlacklist' })
export class ChannelBlacklist extends Precondition {
    client = this.container.client

    public override messageRun(message: Message<boolean>, command: MessageCommand, context: PreconditionContext): PreconditionResult {
        return this.isChannelBlacklisted(message.guild, message, message.channelId)
    }

    public override chatInputRun(interaction: ChatInputCommandInteraction): AllFlowsPrecondition.Result {
        return this.isChannelBlacklisted(interaction.guild, interaction, interaction.channelId)
    }

    public override contextMenuRun(interaction: ContextMenuCommandInteraction): AllFlowsPrecondition.Result {
        return this.isChannelBlacklisted(interaction.guild, interaction, interaction.channelId)
    }

    private isChannelBlacklisted(guild: Guild, m: Message | ChatInputCommandInteraction | ContextMenuCommandInteraction, channelId: string): PreconditionResult {
        const blacklistedChannels: string[] = this.client.settings.get(guild, 'blacklists.channels', [])
        return (!blacklistedChannels.includes(channelId) && m.member.user.id !== this.client.owner) ? this.ok() : this.channelBlacklistError()
    }

    private channelBlacklistError(): AllFlowsPrecondition.Result {
        return this.error({
            identifier: Identifiers.PreconditionUnavailable,
            message: 'The channel you are trying to use this command in is blacklisted.',
        })
    }
}