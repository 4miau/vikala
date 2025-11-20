import { Piece } from '@sapphire/pieces'
import { ApplyOptions } from '@sapphire/decorators'

import Task from '../../lib/mods/Task'
import { ggDealsApi } from '../../lib/util/constants'
import { envs } from '../../lib/util/environmentVariables'

@ApplyOptions<Piece.Options>({ name: 'ggdeals' })
export default class GGDeals extends Task {
    client = this.container.client

    async exec(gameId: string, region?: string) {
        const validRegion = ['au', 'be', 'br', 'ca', 'ch', 'de', 'dk', 'es', 'eu', 'fi', 'fr', 'gb', 'ie', 'it', 'nl', 'no', 'pl', 'se', 'us'].includes(region) ? region : 'us'

        const obj = {
            method: 'GET',
            url: ggDealsApi,
            params: {
                key: envs.GGDEALS_API_KEY,
                ids: gameId,
                region: validRegion
            }
        }

        return this.client.api.set(obj).call().then((res) => res.data[gameId])
    }
}