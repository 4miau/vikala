import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { gogCatalogApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getgoggame' })
export default class GetGogGame extends Task {
	client = this.container.client

	async exec(searchQuery: string, limit: number = 5) {
		const obj = {
			method: 'GET' as const,
			url: `${gogCatalogApi}?query=${encodeURIComponent(searchQuery)}&limit=${limit}`
		}

		return this.client.api.set(obj).call()
	}
}
