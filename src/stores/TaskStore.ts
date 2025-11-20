import { Store } from '@sapphire/framework'
import Task from '../lib/mods/Task'
import { ApplyOptions } from '@sapphire/decorators'

ApplyOptions<Store.Options<Task>>({ name: 'tasks' })
export class TaskStore extends Store<Task, 'tasks'> {
    constructor() {
        super(Task, { name: 'tasks' })
    }
}