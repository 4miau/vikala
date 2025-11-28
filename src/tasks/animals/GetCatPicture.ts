import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'

import Task from '../../lib/mods/Task'
import { catApi } from '../../lib/util/constants'

@ApplyOptions<Piece.Options>({ name: 'getcatpicture' })
export class GetCatPicture extends Task {
    client = this.container.client

    async exec() {
        const obj: any = {
            method: 'GET',
            url: catApi
        }

        return this.client.api.set(obj)
            .call()
    }
}