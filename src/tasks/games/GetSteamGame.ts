import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { steamApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getsteamgame' })
export default class GetSteamGame extends Task {
    client = this.container.client

    async exec(gameId: string) {
        const obj = {
            method: 'GET',
            url: `${steamApi}${gameId}&l=en`
        }

        return this.client.api.set(obj)
            .call()
            .then((res) => res[gameId].data)
    }
}