import { isFunc } from 'miau-utilities'
import Vikala from '../client/vikala'

interface QueueTask {
    task: () => Promise<any> | any
    resolve: (value?: any) => void
    reject: (reason?: any) => void
}

export default class Queue {
    protected _queue: QueueTask[]
    protected _running: boolean
    protected client: Vikala
    private readonly _delay: number
    private _processTimeout: NodeJS.Timeout | null = null

    constructor(cli: Vikala, delayMs: number = 1000) {
        this._queue = []
        this._running = false
        this.client = cli
        this._delay = delayMs
    }

    get length() { return this._queue.length }
    get isRunning() { return this._running }
    get delay() { return this._delay }

    add<T = any>(task: () => Promise<T> | T): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!isFunc(task)) {
                reject(new Error('Task must be a function'))
                return
            }

            this._queue.push({ task, resolve, reject })

            if (!this._running) this._startProcessing()
        })
    }

    clear(): number {
        const count = this._queue.length
        this._queue.forEach(({ reject }) => reject(new Error('Queue cleared')))
        this._queue = []
        return count
    }

    pause(): void {
        this._running = false
        if (this._processTimeout) {
            clearTimeout(this._processTimeout)
            this._processTimeout = null
        }
    }

    resume(): void {
        if (!this._running && this._queue.length > 0) this._startProcessing()
    }

    private _startProcessing(): void {
        if (this._running) return
        this._running = true
        this._processNext()
    }

    private async _processNext(): Promise<void> {
        const queueItem = this._queue.shift()

        if (!queueItem) {
            this._running = false
            return
        }

        try {
            const result = await Promise.resolve(queueItem.task())
            queueItem.resolve(result)
        } catch (error) {
            this.client.logger.error('QUEUE_TASK_ERROR', error)
            queueItem.reject(error)
        }

        if (this._queue.length > 0 && this._running) this._processTimeout = setTimeout(() => this._processNext(), this._delay)
        else this._running = false
    }
}