import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'

import Task from '../../lib/mods/Task'
import { dogApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getdogpicture' })
export class GetDogPicture extends Task {
    client = this.container.client

    async exec() {
        const obj: any = {
            method: 'GET',
            url: dogApi
        }

        return this.client.api.set(obj)
            .call()
    }
}