import * as watcher from '@parcel/watcher'
import path from 'path'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { glob } from 'glob'

import Vikala from '../client/vikala'

export default class HotReloadWatcher {
	private client: Vikala
	private subscription: watcher.AsyncSubscription | null = null
	private isEnabled = false
	private fileHashes = new Map<string, string>()

	private watchPatterns = ['dist/tasks/**/*.js', 'dist/structures/**/*.js', 'dist/commands/**/*.js', 'dist/events/**/*.js']

	private ignorePatterns = ['**/*.d.ts', '**/node_modules/**', '**/src/**', '**/*.map']

	constructor(client: Vikala) {
		this.client = client
	}

	public async start(): Promise<void> {
		if (this.isEnabled) {
			this.client.logger.warn('Hot reload watcher is already running')
			return
		}

		try {
			this.subscription = await watcher.subscribe(
				path.resolve('dist'),
				(err, events) => {
					if (err) {
						this.client.logger.error('File watcher error:', err)
						return
					}

					for (const event of events) {
						const filePath = event.path

						if (!this.shouldWatchFile(filePath)) continue

						if (event.type === 'create') {
							this.handleFileAdd(filePath)
						} else if (event.type === 'update') {
							this.handleFileChange(filePath)
						}
					}
				},
				{
					ignore: this.ignorePatterns
				}
			)

			this.initializeFileHashes()
			this.isEnabled = true
		} catch (error) {
			this.client.logger.error('Failed to start file watcher:', error)
		}
	}

	public async stop(): Promise<void> {
		if (this.subscription) {
			await this.subscription.unsubscribe()
			this.subscription = null
		}
		this.isEnabled = false
		this.client.logger.info('Hot reload file watcher stopped')
	}

	private initializeFileHashes(): void {
		for (const pattern of this.watchPatterns) {
			try {
				const files = glob.sync(pattern, { cwd: process.cwd() })
				for (const file of files) {
					const fullPath = path.resolve(file)
					if (this.shouldWatchFile(fullPath)) {
						try {
							const content = readFileSync(fullPath, 'utf8')
							const hash = createHash('md5').update(content).digest('hex')
							this.fileHashes.set(fullPath, hash)
						} catch (error) {
							continue
						}
					}
				}
			} catch (error) {
				this.client.logger.warn(`Failed to initialize hashes for pattern ${pattern}:`, error)
			}
		}

		this.client.logger.info(`Initialized content hashes for ${this.fileHashes.size} files`)
	}

	private shouldWatchFile(filePath: string): boolean {
		const relativePath = path.relative(process.cwd(), filePath)

		if (!relativePath.endsWith('.js')) return false

		const watchedDirs = ['dist/tasks', 'dist/structures', 'dist/commands', 'dist/events']
		return watchedDirs.some((dir) => relativePath.startsWith(dir))
	}
	private async handleFileChange(filePath: string): Promise<void> {
		const normalizedPath = path.normalize(filePath)
		const relativePath = path.relative(process.cwd(), normalizedPath)

		if (!this.hasFileContentChanged(normalizedPath)) return

		try {
			if (relativePath.includes('/tasks/')) {
				await this.reloadTask(relativePath)
			} else if (relativePath.includes('/structures/')) {
				await this.reloadStructure(relativePath)
			} else if (relativePath.includes('/commands/')) {
				await this.reloadCommand(relativePath)
			} else if (relativePath.includes('/events/')) {
				await this.reloadEvent(relativePath)
			}
		} catch (error) {
			this.client.logger.error(`Failed to hot reload ${relativePath}:`, error)
		}
	}

	private hasFileContentChanged(filePath: string): boolean {
		try {
			const content = readFileSync(filePath, 'utf8')
			const currentHash = createHash('md5').update(content).digest('hex')
			const previousHash = this.fileHashes.get(filePath)

			if (previousHash !== currentHash) {
				this.fileHashes.set(filePath, currentHash)
				return true
			}

			return false
		} catch (error) {
			this.client.logger.warn(`Cannot read file for hash comparison: ${filePath}`)
			return true
		}
	}

	private async handleFileAdd(filePath: string): Promise<void> {
		const relativePath = path.relative(process.cwd(), filePath)

		this.client.logger.info(`➕ New compiled file added: ${relativePath}`)

		try {
			if (relativePath.includes('/tasks/')) {
				const success = await this.client.tasks.loadNewTask(filePath)
				if (success) {
					this.client.logger.info(`✨ Loaded new task from: ${relativePath}`)
				}
			} else if (relativePath.includes('/structures/')) {
				await this.loadNewStructure(relativePath)
			} else if (relativePath.includes('/commands/')) {
				await this.loadNewCommand(relativePath)
			} else if (relativePath.includes('/events/')) {
				await this.loadNewEvent(relativePath)
			}
		} catch (error) {
			this.client.logger.error(`Failed to load new file ${relativePath}:`, error)
		}
	}

	private async reloadTask(filePath: string): Promise<void> {
		const fileName = path.basename(filePath, '.js')
		const taskName = fileName.toLowerCase()

		const success = await this.client.tasks.reloadTask(taskName)
		if (success) {
			this.client.logger.info(`Hot reloaded task: ${taskName}`)
		}
	}

	private async reloadStructure(filePath: string): Promise<void> {
		const fileName = path.basename(filePath, '.js')

		const result = await this.client.hotReloadManager.reloadStructure(fileName)
		if (result.success) {
			this.client.logger.info(`Hot reloaded structure: ${fileName}`)
		} else {
			this.client.logger.warn(result.message)
		}
	}

	private async reloadCommand(filePath: string): Promise<void> {
		const fileName = path.basename(filePath, '.js')
		const commandName = fileName.toLowerCase()

		const command = this.client.stores.get('commands').get(commandName)
		if (command) {
			await command.reload()
			this.client.logger.info(`Hot reloaded command: ${commandName}`)
		}
	}

	private async reloadEvent(filePath: string): Promise<void> {
		const fileName = path.basename(filePath, '.js')
		const eventName = fileName.toLowerCase()

		const listener = this.client.stores.get('listeners').get(eventName)
		if (listener) {
			await listener.reload()
			this.client.logger.info(`Hot reloaded event: ${eventName}`)
		}
	}

	public isRunning(): boolean {
		return this.isEnabled
	}

	private async loadNewStructure(filePath: string): Promise<void> {
		const fileName = path.basename(filePath, '.js')

		const result = await this.client.hotReloadManager.loadNewStructure(fileName)
		if (result.success) {
			this.client.logger.info(`✨ Loaded new structure: ${fileName}`)
		} else {
			this.client.logger.warn(`⚠️ ${result.message}`)
		}
	}

	private async loadNewCommand(filePath: string): Promise<void> {
		try {
			await this.client.stores.get('commands').load(filePath.replace(/\\/g, '/'), filePath)
			const fileName = path.basename(filePath, '.js')
			this.client.logger.info(`✨ Loaded new command: ${fileName}`)
		} catch (error) {
			this.client.logger.error(`Failed to load new command from ${filePath}:`, error)
		}
	}

	private async loadNewEvent(filePath: string): Promise<void> {
		try {
			await this.client.stores.get('listeners').load(filePath.replace(/\\/g, '/'), filePath)
			const fileName = path.basename(filePath, '.js')
			this.client.logger.info(`✨ Loaded new event: ${fileName}`)
		} catch (error) {
			this.client.logger.error(`Failed to load new event from ${filePath}:`, error)
		}
	}
}
