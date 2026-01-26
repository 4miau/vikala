import { Argument } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { isNullish } from '@sapphire/utilities'
import { Guild } from 'discord.js'

@ApplyOptions<Argument.Options>({ name: 'guild' })
export class GuildArgument extends Argument<Guild> {
	public run(parameter: string, context: Argument.Context): Argument.Result<Guild> {
		const guild = this.container.client.guilds.resolve(parameter)

		if (!isNullish(guild)) return this.ok(guild)

		return this.error({
			context,
			parameter,
			message: 'The provided argument could not be resolved to a valid Guild.',
			identifier: 'InvalidGuild'
		})
	}
}
