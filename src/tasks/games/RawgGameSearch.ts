import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { rawgApi } from '../../lib/util/constants'
import { envs } from '../../lib/util/environmentVariables'


@ApplyOptions<Piece.Options>({ name: 'rawggamesearch' })
export default class RawgGameSearch extends Task {
    client = this.container.client

    async exec(query: string) {
        const obj = {
            method: 'GET',
            url: [rawgApi, 'games'].join('/'),
            params: {
                search: query,
                page_size: 10,
                key: envs.RAWG_API_KEY
            }
        }

        return this.client.api.set(obj)
            .call()
            .then((res) => res.results)
    }
}