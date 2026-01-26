import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { danbooruApi } from '../../lib/util/constants'

declare type booruOptions = {
	latest?: boolean
	safe?: boolean
}

@ApplyOptions<Piece.Options>({ name: 'getbooruimage' })
export default class GetBooruImage extends Task {
	client = this.container.client

	async exec(query: string, options?: booruOptions) {
		const obj = {
			method: 'GET',
			url: `${danbooruApi}/${options.latest ? 'posts.json' : 'posts/random.json'}`,
			params: {
				tags: query.replaceAll(' ', '_'),
				rating: options?.safe ? 's' : undefined,
				limit: 1
			}
		}

		return this.client.api.set(obj).call()
	}
}
