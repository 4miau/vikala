import { ApplyOptions } from '@sapphire/decorators'
import { Argument } from '@sapphire/framework'
import { isNullish } from '@sapphire/utilities'

import { LogType } from '../typings/@definitions/Arguments'

@ApplyOptions<Argument.Options>({ name: 'logtype' })
export class LogTypeArgument extends Argument<LogType> {
	public run(parameter: string, context: Argument.Context): Argument.Result<LogType> {
		const validLogTypes = ['channel', 'message', 'guild', 'moderation', 'role', 'user', 'all']

		if (!isNullish(parameter) && validLogTypes.includes(parameter.toLowerCase())) return this.ok(parameter.toLowerCase() as LogType)

		return this.error({
			context,
			parameter,
			message: 'The provided argument could not be resolved to a valid log type.',
			identifier: 'InvalidLogType'
		})
	}
}
