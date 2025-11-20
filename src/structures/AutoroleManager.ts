import { GuildMember, Guild, Role } from 'discord.js'

import Vikala from '../client/vikala'
import AutoroleRule, { IAutoroleRule } from '../database/AutoroleRule'

export default class AutoroleManager {
    private client: Vikala
    private delayedRoles = new Map<string, NodeJS.Timeout>()

    constructor(client: Vikala) {
        this.client = client
    }

    public async handleMemberJoin(member: GuildMember): Promise<void> {
        const rules = await this.getActiveRules(member.guild.id, 'join')
        
        for (const rule of rules) {
            if (await this.shouldApplyRule(member, rule)) {
                if (rule.delay > 0) {
                    this.scheduleDelayedRole(member, rule)
                } else {
                    await this.applyRole(member, rule)
                }
            }
        }
    }

    public async handleMemberBoost(member: GuildMember): Promise<void> {
        const rules = await this.getActiveRules(member.guild.id, 'boost')
        
        for (const rule of rules) {
            if (await this.shouldApplyRule(member, rule)) {
                await this.applyRole(member, rule)
            }
        }
    }

    private async getActiveRules(guildId: string, type: 'join' | 'time' | 'boost'): Promise<IAutoroleRule[]> {
        return await AutoroleRule.find({ 
            guildId, 
            type, 
            enabled: true 
        }).sort({ priority: -1 })
    }

    private async shouldApplyRule(member: GuildMember, rule: IAutoroleRule): Promise<boolean> {
        const { conditions } = rule

        const role = member.guild.roles.cache.get(rule.roleId)
        if (!role) return false

        if (member.roles.cache.has(rule.roleId)) return false
        if (conditions.excludeBots && member.user.bot) return false

        if (conditions.minAccountAge > 0) {
            const minAge = conditions.minAccountAge * 24 * 60 * 60 * 1000
            const accountAge = Date.now() - member.user.createdTimestamp
            if (accountAge < minAge) return false
        }

        if (conditions.requiredRoles && conditions.requiredRoles.length > 0) {
            const hasAllRequired = conditions.requiredRoles.every(roleId => member.roles.cache.has(roleId))
            if (!hasAllRequired) return false
        }
        if (conditions.excludeRoles && conditions.excludeRoles.length > 0) {
            const hasExcludeRole = conditions.excludeRoles.some(roleId => 
                member.roles.cache.has(roleId)
            )
            if (hasExcludeRole) return false
        }

        return true
    }

    private scheduleDelayedRole(member: GuildMember, rule: IAutoroleRule): void {
        const timeoutKey = `${member.id}-${rule.roleId}`
        
        if (this.delayedRoles.has(timeoutKey)) {
            clearTimeout(this.delayedRoles.get(timeoutKey)!)
        }

        const timeout = setTimeout(async () => {
            try {
                const currentMember = await member.guild.members.fetch(member.id)
                if (currentMember && await this.shouldApplyRule(currentMember, rule)) {
                    await this.applyRole(currentMember, rule)
                }
            } catch (error) {
                console.error(`Failed to apply delayed autorole: ${error}`)
            } finally {
                this.delayedRoles.delete(timeoutKey)
            }
        }, rule.delay)

        this.delayedRoles.set(timeoutKey, timeout)
    }

    private async applyRole(member: GuildMember, rule: IAutoroleRule): Promise<void> {
        try {
            const role = member.guild.roles.cache.get(rule.roleId)
            if (!role) return

            await member.roles.add(role, `Autorole: ${rule.type}`)
            
            if (rule.removeConflicting) {
                await this.handleConflictingRoles(member, rule)
            }

            console.log(`Applied autorole ${role.name} to ${member.user.tag} in ${member.guild.name}`)
        } catch (error) {
            console.error(`Failed to apply autorole to ${member.user.tag}: ${error}`)
        }
    }

    private async handleConflictingRoles(member: GuildMember, appliedRule: IAutoroleRule): Promise<void> {
        const conflictingRules = await AutoroleRule.find({
            guildId: member.guild.id,
            priority: { $lt: appliedRule.priority },
            removeConflicting: true,
            enabled: true
        })

        for (const conflictingRule of conflictingRules) {
            if (member.roles.cache.has(conflictingRule.roleId)) {
                try {
                    await member.roles.remove(conflictingRule.roleId, `Autorole conflict resolution`)
                } catch (error) {
                    console.error(`Failed to remove conflicting role: ${error}`)
                }
            }
        }
    }

    public async addRule(
        guildId: string,
        type: 'join' | 'time' | 'boost',
        roleId: string,
        options: {
            delay?: number
            minAccountAge?: number
            excludeBots?: boolean
            requiredRoles?: string[]
            excludeRoles?: string[]
            priority?: number
            removeConflicting?: boolean
        } = {}
    ): Promise<IAutoroleRule> {
        const rule = new AutoroleRule({
            guildId,
            type,
            roleId,
            delay: options.delay || 0,
            conditions: {
                minAccountAge: options.minAccountAge || null,
                excludeBots: options.excludeBots !== false,
                requiredRoles: options.requiredRoles || [],
                excludeRoles: options.excludeRoles || []
            },
            priority: options.priority || 0,
            removeConflicting: options.removeConflicting || false,
            enabled: true
        })

        return await rule.save()
    }

    public async removeRule(guildId: string, roleId: string): Promise<boolean> {
        const result = await AutoroleRule.deleteOne({ guildId, roleId })
        return result.deletedCount > 0
    }

    public async getRules(guildId: string, type?: 'join' | 'time' | 'boost'): Promise<IAutoroleRule[]> {
        const filter: any = { guildId }
        if (type) filter.type = type

        return await AutoroleRule.find(filter).sort({ priority: -1, createdAt: 1 })
    }

    public async toggleRule(guildId: string, roleId: string, enabled: boolean): Promise<boolean> {
        const result = await AutoroleRule.updateOne(
            { guildId, roleId },
            { enabled }
        )
        return result.modifiedCount > 0
    }

    public async updateRulePriority(guildId: string, roleId: string, priority: number): Promise<boolean> {
        const result = await AutoroleRule.updateOne(
            { guildId, roleId },
            { priority }
        )
        return result.modifiedCount > 0
    }

    public clearDelayedRole(memberId: string, ruleId: string): void {
        const key = `${memberId}-${ruleId}`
        if (this.delayedRoles.has(key)) {
            clearTimeout(this.delayedRoles.get(key)!)
            this.delayedRoles.delete(key)
        }
    }

    public getDelayedRolesCount(): number {
        return this.delayedRoles.size
    }
}