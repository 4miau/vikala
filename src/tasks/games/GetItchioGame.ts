import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'

@ApplyOptions<Piece.Options>({ name: 'getitchiogame' })
export default class GetItchioGame extends Task {
	client = this.container.client

	async exec(game: string) {
		const obj = {
			method: 'GET',
			url: `${game}/data.json`
		}

		return this.client.api.set(obj).call()
	}
}
