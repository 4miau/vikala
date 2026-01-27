import { Argument } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'

import { ActivityStatus } from '../typings/@definitions/Arguments'

@ApplyOptions<Argument.Options>({ name: 'activitystatus' })
export class StatusArgument extends Argument<ActivityStatus> {
	public run(parameter: string, context: Argument.Context): Argument.Result<ActivityStatus> {
		const value = parameter.toLowerCase()

		if (['online', 'o'].some((v) => v === value)) return this.ok('online')
		if (['idle', 'i'].some((v) => v === value)) return this.ok('idle')
		if (['dnd'].some((v) => v === value)) return this.ok('dnd')
		if (['invisible', 'inv', 'offline', 'off'].some((v) => v === value)) return this.ok('invisible')

		return this.error({
			context,
			parameter,
			message: 'The provided argument could not be resolved to a valid ArgumentType.',
			identifier: 'InvalidArgumentType'
		})
	}
}
