import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { rawgApi } from '../../lib/util/constants'
import { envs } from '../../lib/util/environmentVariables'

@ApplyOptions<Piece.Options>({ name: 'rawggamebyid' })
export default class RawgGameById extends Task {
    client = this.container.client

    async exec(gameId: string) {
        const obj = {
            method: 'GET',
            url: [rawgApi, 'games', gameId].join('/'),
            params: { key: envs.RAWG_API_KEY }
        }

        return await this.client.api.set(obj)
            .call()
    }
}