import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'

@ApplyOptions<Piece.Options>({ name: 'getitchiogamepage' })
export default class getItchioGamePage extends Task {
    client = this.container.client

    async exec(gameUrl: string) {
        const obj = {
            method: 'GET',
            url: gameUrl
        }

        return this.client.api.set(obj)
            .call()
    }
}