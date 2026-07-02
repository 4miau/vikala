import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'

import Task from '../../lib/mods/Task'
import { animeQuotesApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getanimequote' })
export class GetAnimeQuote extends Task {
	private client = this.container.client

	async exec(...args: string[]) {
		const obj: any = {
			method: 'GET',
			url: `${animeQuotesApi}?${args[0]}${args[1] ? `=${args[1]}` : ''}`
		}

		return this.client.api.set(obj).call()
	}
}
