import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'

import Task from '../../lib/mods/Task'
import { foxApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getfoxpicture' })
export class GetFoxPicture extends Task {
	private client = this.container.client

	async exec() {
		const obj: any = {
			method: 'GET',
			url: foxApi
		}

		return this.client.api.set(obj).call()
	}
}
