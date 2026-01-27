import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/framework'
import Task from '../../lib/mods/Task'

@ApplyOptions<Piece.Options>({ name: 'cleanupoldsnapshots' })
export class CleanupOldSnapshots extends Task {
	client = this.container.client

	public async exec(): Promise<number> {
		return await this.client.channelSnapshots.cleanupOldSnapshots(90)
	}
}
