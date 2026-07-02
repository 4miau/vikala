import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { gogProductsApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getgoggamedetails' })
export default class GetGogGameDetails extends Task {
	private client = this.container.client

	async exec(gameId: string) {
		const obj = {
			method: 'GET' as const,
			url: `${gogProductsApi}${gameId}?expand=description`
		}

		return this.client.api.set(obj).call()
	}
}
