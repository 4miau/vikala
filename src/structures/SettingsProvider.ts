import { Collection, Guild } from 'discord.js'
import { SapphireClient } from '@sapphire/framework'

import Settings from '../database/Settings'

export default class SettingsProvider {
    public model: typeof Settings
    public items: Collection<string, any>

    public constructor(model: typeof Settings) {
        this.model = model
        this.items = new Collection()
    }

    public async _init() {
        try {
            const guilds = await this.model.find()

            for (const i in guilds) {
                const guild = guilds[i]
                this.items.set(guild.id, guild.settings)
            }
        } catch (err) {
            throw new Error(err as string)
        }
    }

    public get<T>(guild: string | Guild, key: string, defaultValue: T, nested: boolean = true): T | any {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)

        if (this.items.has(id)) {
            const settings = this.items.get(id)

            if (nested) return this.getNestedValue(settings, key, defaultValue)
            else {
                const value = settings[key]
                return !value ? defaultValue : value
            }
        }

        return defaultValue
    }

    public getArr<T extends { key: string, value: any }>(guild: string | Guild, props: T[], nested: boolean = true): T[] {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)

        let propsArr: T[] = []

        for (const prop of props) {
            if (this.items.has(id)) {
                const settings = this.items.get(id)

                if (nested) {
                    const value = this.getNestedValue(settings, prop.key, prop.value)
                    propsArr.push({ key: prop.key, value: value } as T)
                } else {
                    const value = settings[prop.key] as T
                    propsArr.push({ key: prop.key, value: value || prop.value } as T)
                }
            }
        }

        if (propsArr.length > 0) return propsArr

        return props
    }

    public async set(guild: string | Guild, key: string, value: any, nested: boolean = true): Promise<void> {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)
        const data = this.items.get(id) || {}

        if (nested) this.setNestedValue(data, key, value)
        else data[key] = value

        this.items.set(id, data)
        const doc = await this.getDocument(id)

        if (nested)  this.setNestedValue(doc.settings, key, value)
        else doc.settings[key] = value

        return doc.updateOne(doc)
    }

    public async setArr(guild: string | Guild, props: { key: string, value: any }[], nested: boolean = true): Promise<void> {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)
        const data = this.items.get(id) || {}

        const doc = await this.getDocument(id)

        for (const prop of props) {
            if (nested) {
                this.setNestedValue(data, prop.key, prop.value)
                this.setNestedValue(doc.settings, prop.key, prop.value)
            } else {
                data[prop.key] = prop.value
                doc.settings[prop.key] = prop.value
            }
        }

        this.items.set(id, data)
        return doc.updateOne(doc)
    }

    public async delete(guild: string | Guild, key: string, nested: boolean = true): Promise<void> {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)
        const data = this.items.get(id) || {}

        if (nested) this.deleteNestedValue(data, key)
        else delete data[key]

        this.items.set(id, data)

        const doc = await this.getDocument(id)

        if (nested) this.deleteNestedValue(doc.settings, key)
        else delete doc.settings[key]

        return doc.updateOne(doc)
    }

    public async deleteArr(guild: string | Guild, keys: string[], nested: boolean = true): Promise<void> {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)
        const data = this.items.get(id) || {}

        const doc = await this.getDocument(id)

        for (const key of keys) {
            if (nested) {
                this.deleteNestedValue(data, key)
                this.deleteNestedValue(doc.settings, key)
            } else {
                delete data[key]
                delete doc.settings[key]
            }
        }

        this.items.set(id, data)
        return doc.updateOne(doc)
    }

    public async clear(guild: string | Guild): Promise<void> {
        const id = (this.constructor as typeof SettingsProvider).getGuildID(guild)
        this.items.delete(id)

        const doc = await this.getDocument(id)
        if (doc) await doc.deleteOne()
    }

    public async clearAll(client: SapphireClient): Promise<void> {
        this.items.clear()

        client.guilds.cache.forEach(async (g) => {
            const id = (this.constructor as typeof SettingsProvider).getGuildID(g)

            const doc = await this.getDocument(id)
            if (doc) await doc.deleteOne()
        })
    }

    private getNestedValue(obj: any, path: string, defaultValue: any): any {
        const keys = path.split('.')
        let current = obj

        for (const key of keys) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return defaultValue
            }
            current = current[key]
        }

        return current !== undefined ? current : defaultValue
    }

    private setNestedValue(obj: any, path: string, value: any): any {
        const keys = path.split('.')
        let current = obj

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (current[key] === undefined || typeof current[key] !== 'object' || Array.isArray(current[key])) {
                current[key] = {}
            }
            current = current[key]
        }

        current[keys[keys.length - 1]] = value
        return obj
    }

    private deleteNestedValue(obj: any, path: string): any {
        const keys = path.split('.')
        let current = obj

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]
            if (current[key] === undefined || typeof current[key] !== 'object') {
                return obj
            }
            current = current[key]
        }

        delete current[keys[keys.length - 1]]
        return obj
    }

    public async getDocument(id: string) {
        const obj = await this.model.findOne({ id })

        if (!obj) {
            const newDoc = await new this.model({ id, settings: {}}).save()
            return newDoc
        }

        return obj
    }

    public async getNextCaseId(guild: string | Guild): Promise<number> {
        const current: number = this.get(guild, 'totalCaseCount', 0)
        const next = current + 1
        await this.set(guild, 'totalCaseCount', next)
        return next
    }

    public static getGuildID(guild: string | Guild): string {
        if (guild instanceof Guild) return guild.id
        if (guild === 'global' || guild === null) return '0'
        if (typeof guild === 'string' && /^\d+$/.test(guild)) return guild

        throw new TypeError('Guild instance is undefined. The valid instances would be: guildID, \'global\' or null')
    }
}