import { Store } from '@sapphire/framework'
import Task from '../lib/mods/Task'
import { ApplyOptions } from '@sapphire/decorators'
import fs from 'fs'

@ApplyOptions<Store.Options<Task>>({ name: 'tasks' })
export class TaskStore extends Store<Task, 'tasks'> {
	constructor() {
		super(Task, { name: 'tasks' })
	}

	public async reloadTask(taskName: string): Promise<boolean> {
		try {
			const existingTask = this.get(taskName.toLowerCase())
			if (!existingTask) {
				throw new Error(`Task '${taskName}' not found in store`)
			}

			const taskPath = existingTask.location.full
			delete require.cache[taskPath]

			await this.unload(taskName.toLowerCase())
			await this.load(taskPath.replace(/\\/g, '/'), taskPath)

			return true
		} catch (error) {
			this.container.client.logger.error(`Failed to reload task '${taskName}':`, error)
			return false
		}
	}

	public async reloadAllTasks(): Promise<{ success: number; failed: string[] }> {
		const results = { success: 0, failed: [] as string[] }
		const taskNames = Array.from(this.keys())

		for (const taskName of taskNames) {
			const success = await this.reloadTask(taskName)
			if (success) results.success++
			else results.failed.push(taskName)
		}

		return results
	}

	public async loadNewTask(filePath: string): Promise<boolean> {
		try {
			if (fs.existsSync(filePath)) {
				await this.load(filePath.replace(/\\/g, '/'), filePath)
				return true
			}
			return false
		} catch (error) {
			this.container.client.logger.error(`Failed to load new task from '${filePath}':`, error)
			return false
		}
	}
}
