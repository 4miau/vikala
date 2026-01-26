import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'

import Task from '../../lib/mods/Task'

@ApplyOptions<Piece.Options>({ name: 'getanimewaifu' })
export class GetAnimeWaifu extends Task {
	async exec() {}
}
