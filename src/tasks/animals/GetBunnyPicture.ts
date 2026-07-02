import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'

import Task from '../../lib/mods/Task'
import { bunnyApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getbunnypicture' })
export class GetBunnyPicture extends Task {
	private client = this.container.client

	async exec() {
		const obj: any = {
			method: 'GET',
			url: bunnyApi
		}

		return this.client.api.set(obj).call()
	}
}
