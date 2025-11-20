import { Argument } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'

import { ActivityType } from '../typings/@definitions/Arguments'

@ApplyOptions<Argument.Options>({ name: 'activitytype' })
export class ActivityTypeArgument extends Argument<Number> {
    public run(parameter: string, context: Argument.Context): Argument.Result<Number> {
        const value = parameter.toUpperCase() as ActivityType

        if (['PLAYING', 'P'].some(v => v === value)) return this.ok(0)
        if (['STREAMING', 'S'].some(v => v === value)) return this.ok(1)
        if (['LISTENING', 'L'].some(v => v === value)) return this.ok(2)
        if (['WATCHING', 'W'].some(v => v === value)) return this.ok(3)
        if (['COMPETING', 'C'].some(v => v === value)) return this.ok(5)

        return this.error({
            context,
            parameter,
            message: 'The provided argument could not be resolved to a valid ActivityType.',
            identifier: 'InvalidActivityType'
        })
    }
}