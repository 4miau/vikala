import mongoose from 'mongoose'

export interface IAutoroleRule extends mongoose.Document {
    guildId: string
    type: 'join' | 'time' | 'boost'
    roleId: string
    delay: number
    conditions: {
        minAccountAge?: number
        excludeBots: boolean
        requiredRoles?: string[]
        excludeRoles?: string[]
    }
    enabled: boolean
    priority: number
    removeConflicting: boolean
    createdAt: Date
}

const Schema = mongoose.Schema
const autoroleRuleSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['join', 'time', 'boost'],
        required: true,
        index: true
    },
    roleId: {
        type: String,
        required: true
    },
    delay: {
        type: Number,
        default: 0
    },
    conditions: {
        minAccountAge: {
            type: Number,
            default: null
        },
        excludeBots: {
            type: Boolean,
            default: true
        },
        requiredRoles: [{
            type: String,
            required: false
        }],
        excludeRoles: [{
            type: String,
            required: false
        }]
    },
    enabled: {
        type: Boolean,
        default: true
    },
    priority: {
        type: Number,
        default: 0,
        index: true
    },
    removeConflicting: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'autorolerules' })

const AutoroleRule = mongoose.model<IAutoroleRule>('AutoroleRule', autoroleRuleSchema)

export default AutoroleRule