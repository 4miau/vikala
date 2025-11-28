import { Argument, Resolvers } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { isNullish } from '@sapphire/utilities'

import { SendableChannel } from '../typings/@definitions/Arguments'

@ApplyOptions<Argument.Options>({ name: 'sendablechannel' })
export class SendableChannelArgument extends Argument<SendableChannel> {
    public run(parameter: string, context: Argument.Context): Argument.Result<SendableChannel> {
        const channelResult = Resolvers.resolveGuildChannel(parameter, context.message!.guild)

        if (channelResult.ok && !isNullish(channelResult) && channelResult.unwrap().isSendable()) return this.ok(channelResult.unwrap() as SendableChannel)

        return this.error({
            context,
            parameter,
            message: 'The provided argument could not be resolved to a valid SendableChannel.',
            identifier: 'InvalidSendableChannel'
        })
    }
}