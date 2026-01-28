import path from 'path'
import Vikala from '../client/vikala'

export default class ReloadManager {
	private client: Vikala
	private structureBlacklist = new Set(['SettingsProvider', 'APIManager', 'Queue'])

	constructor(client: Vikala) {
		this.client = client
	}

	public async reloadStructure(structureName: string): Promise<{ success: boolean; message: string }> {
		try {
			const validation = this.validateName(structureName, 'structure')
			if (!validation.valid) {
				return {
					success: false,
					message: validation.error!
				}
			}

			if (this.structureBlacklist.has(structureName)) {
				return {
					success: false,
					message: `Structure '${structureName}' is blacklisted for safety reasons. Use full restart instead.`
				}
			}

			const structurePath = path.join(__dirname, '..', 'structures', `${structureName}.ts`)
			const structureJsPath = path.join(__dirname, '..', 'structures', `${structureName}.js`)

			if (!require('fs').existsSync(structurePath) && !require('fs').existsSync(structureJsPath)) {
				return {
					success: false,
					message: `Structure file '${structureName}' not found`
				}
			}

			delete require.cache[require.resolve(`../structures/${structureName}`)]

			const StructureModule = require(`../structures/${structureName}`)
			const StructureClass = StructureModule.default || StructureModule

			const propertyName = structureName.charAt(0).toLowerCase() + structureName.slice(1)

			const oldInstance = (this.client as any)[propertyName]
			if (oldInstance && typeof oldInstance === 'object' && 'destroy' in oldInstance) {
				await (oldInstance as any).destroy()
			}

			const newInstance = new StructureClass(this.client)

			if (newInstance && typeof newInstance === 'object' && '_init' in newInstance) {
				await newInstance._init()
			}

			;(this.client as any)[propertyName] = newInstance

			this.client.logger.info(`🔄 Reloaded structure: ${structureName}`)

			return {
				success: true,
				message: `Successfully reloaded structure: ${structureName}`
			}
		} catch (error) {
			this.client.logger.error(`Failed to reload structure '${structureName}':`, error)
			return {
				success: false,
				message: `Failed to reload structure: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	public async reloadModel(modelName: string): Promise<{ success: boolean; message: string }> {
		try {
			const validation = this.validateName(modelName, 'model')
			if (!validation.valid) {
				return {
					success: false,
					message: validation.error!
				}
			}

			const modelPath = path.join(__dirname, '..', 'database', `${modelName}.ts`)
			const modelJsPath = path.join(__dirname, '..', 'database', `${modelName}.js`)

			if (!require('fs').existsSync(modelPath) && !require('fs').existsSync(modelJsPath)) {
				return {
					success: false,
					message: `Model file '${modelName}' not found`
				}
			}

			delete require.cache[require.resolve(`../database/${modelName}`)]

			require(`../database/${modelName}`)

			this.client.logger.info(`🔄 Reloaded model: ${modelName}`)

			return {
				success: true,
				message: `Successfully reloaded model: ${modelName} (Note: Existing connections remain active)`
			}
		} catch (error) {
			this.client.logger.error(`Failed to reload model '${modelName}':`, error)
			return {
				success: false,
				message: `Failed to reload model: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	public addToBlacklist(structureName: string): void {
		this.structureBlacklist.add(structureName)
		this.client.logger.info(`Added '${structureName}' to reload blacklist`)
	}

	public removeFromBlacklist(structureName: string): void {
		this.structureBlacklist.delete(structureName)
		this.client.logger.info(`Removed '${structureName}' from reload blacklist`)
	}

	public getBlacklist(): string[] {
		return Array.from(this.structureBlacklist)
	}

	public async loadNewStructure(structureName: string): Promise<{ success: boolean; message: string }> {
		try {
			const validation = this.validateName(structureName, 'structure')
			if (!validation.valid) {
				return {
					success: false,
					message: validation.error!
				}
			}

			if (this.structureBlacklist.has(structureName)) {
				return {
					success: false,
					message: `Structure '${structureName}' is blacklisted for safety reasons.`
				}
			}

			const propertyName = structureName.charAt(0).toLowerCase() + structureName.slice(1)
			if ((this.client as any)[propertyName]) {
				return {
					success: false,
					message: `Structure '${structureName}' is already loaded. Use reload instead.`
				}
			}

			const StructureModule = require(`../structures/${structureName}`)
			const StructureClass = StructureModule.default || StructureModule

			const newInstance = new StructureClass(this.client)

			if (newInstance && typeof newInstance === 'object' && '_init' in newInstance) {
				await newInstance._init()
			}

			;(this.client as any)[propertyName] = newInstance

			this.client.logger.info(`✨ Loaded new structure: ${structureName}`)

			return {
				success: true,
				message: `Successfully loaded new structure: ${structureName}`
			}
		} catch (error) {
			this.client.logger.error(`Failed to load new structure '${structureName}':`, error)
			return {
				success: false,
				message: `Failed to load new structure: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	public async loadNewModel(modelName: string): Promise<{ success: boolean; message: string }> {
		try {
			const validation = this.validateName(modelName, 'model')
			if (!validation.valid) {
				return {
					success: false,
					message: validation.error!
				}
			}

			require(`../database/${modelName}`)

			this.client.logger.info(`✨ Loaded new model: ${modelName}`)

			return {
				success: true,
				message: `Successfully loaded new model: ${modelName}`
			}
		} catch (error) {
			this.client.logger.error(`Failed to load new model '${modelName}':`, error)
			return {
				success: false,
				message: `Failed to load new model: ${error instanceof Error ? error.message : String(error)}`
			}
		}
	}

	private validateName(name: string, type: 'structure' | 'model'): { valid: boolean; error?: string } {
		// Block reserved property names to prevent prototype pollution
		const reservedNames = ['__proto__', 'prototype', 'constructor']
		const normalizedName = name.toLowerCase()

		if (reservedNames.includes(normalizedName)) {
			return {
				valid: false,
				error: `Invalid ${type} name. Reserved identifiers like '__proto__', 'prototype', and 'constructor' are not allowed.`
			}
		}

		// Only allow alphanumeric characters, underscores, and hyphens
		const validNamePattern = /^[a-zA-Z0-9_-]+$/

		if (!validNamePattern.test(name)) {
			return {
				valid: false,
				error: `Invalid ${type} name. Only alphanumeric characters, underscores, and hyphens are allowed.`
			}
		}

		// Prevent path traversal patterns
		if (name.includes('..') || name.includes('/') || name.includes('\\')) {
			return {
				valid: false,
				error: `Invalid ${type} name. Path traversal patterns are not allowed.`
			}
		}

		return { valid: true }
	}
}
