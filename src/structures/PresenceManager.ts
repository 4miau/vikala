import { ActivityType, PresenceData } from 'discord.js'
import ms from 'ms'

import Vikala from '../client/vikala'

interface StoredPresence {
    name: string
    type: ActivityType
    status: 'online' | 'idle' | 'dnd' | 'invisible'
    url?: string
}

export default class PresenceManager {
    private client: Vikala
    private cycleInterval?: NodeJS.Timeout
    private currentIndex: number = 0
    private isManualOverride: boolean = false
    private defaultPresences: StoredPresence[] = [
        { name: 'どどど、どうすれば！？', type: ActivityType.Streaming, status: 'dnd', url: 'https://twitch.tv/4miau' },
        { name: 'せめてチーズがあったら…', type: ActivityType.Streaming, status: 'dnd', url: 'https://twitch.tv/4miau' },
        { name: 'watching 4miau the femboy', type: ActivityType.Streaming, status: 'dnd', url: 'https://twitch.tv/4miau' },
        { name: 'coding!', type: ActivityType.Streaming, status: 'dnd', url: 'https://twitch.tv/4miau' }
    ]

    constructor(client: Vikala) {
        this.client = client
    }

    public async _init() {
        const existingPresences = this.client.settings.get('global', 'presence.cycle', null)
        if (!existingPresences) await this.client.settings.set('global', 'presence.cycle', this.defaultPresences)

        const interval = this.client.settings.get('global', 'presence.interval', ms('5m'))
        await this.client.settings.set('global', 'presence.interval', interval)

        const cyclingEnabled = this.client.settings.get('global', 'presence.enabled', true)
        if (cyclingEnabled) this.startCycling()
    }

    public setInitialPresence() {
        if (this.client.user && !this.isManualOverride) this.nextPresence()
    }

    public startCycling() {
        if (this.cycleInterval) this.stopCycling()

        const interval = this.client.settings.get('global', 'presence.interval', ms('5m'))

        if (this.client.user && !this.isManualOverride) this.nextPresence()

        this.cycleInterval = setInterval(() => { if (!this.isManualOverride) this.nextPresence() }, interval)
        this.client.settings.set('global', 'presence.enabled', true)
    }

    public stopCycling() {
        if (this.cycleInterval) {
            clearInterval(this.cycleInterval)
            this.cycleInterval = undefined
        }
        this.client.settings.set('global', 'presence.enabled', false)
    }

    public setManualPresence(name: string, type: ActivityType, status: 'online' | 'idle' | 'dnd' | 'invisible', url?: string) {
        this.isManualOverride = true

        const activity: any = { name, type }
        if (type === ActivityType.Streaming && url) {
            activity.url = url
        }

        const presence: PresenceData = {
            activities: [activity],
            status
        }

        this.client.user?.setPresence(presence)
    }

    public resumeCycling() {
        this.isManualOverride = false
        this.nextPresence()
    }

    public async addPresence(name: string, type: ActivityType, status: 'online' | 'idle' | 'dnd' | 'invisible', url?: string) {
        const presences = this.getPresences()
        const newPresence: StoredPresence = { name, type, status }
        if (url) newPresence.url = url
        presences.push(newPresence)
        await this.client.settings.set('global', 'presence.cycle', presences)
    }

    public async removePresence(index: number) {
        const presences = this.getPresences()
        if (index < 0 || index >= presences.length) throw new Error('Invalid presence index')

        presences.splice(index, 1)
        await this.client.settings.set('global', 'presence.cycle', presences)

        if (this.currentIndex >= presences.length) this.currentIndex = 0
    }

    public getPresences(): StoredPresence[] {
        return this.client.settings.get('global', 'presence.cycle', this.defaultPresences)
    }

    public async setInterval(intervalMs: number) {
        await this.client.settings.set('global', 'presence.interval', intervalMs)
        if (this.cycleInterval) this.startCycling()
    }

    public getInterval(): number {
        return this.client.settings.get('global', 'presence.interval', ms('5m'))
    }

    public isCycling(): boolean {
        return this.cycleInterval !== undefined
    }

    public isOverridden(): boolean {
        return this.isManualOverride
    }

    private nextPresence() {
        if (!this.client.user) return

        const presences = this.getPresences()
        if (presences.length === 0) return

        const presence = presences[this.currentIndex]
        const activity: any = { name: presence.name, type: presence.type }
        if (presence.type === ActivityType.Streaming && presence.url) activity.url = presence.url

        const presenceData: PresenceData = {
            activities: [activity],
            status: presence.status
        }

        this.client.user.setPresence(presenceData)
        this.currentIndex = (this.currentIndex + 1) % presences.length
    }
}