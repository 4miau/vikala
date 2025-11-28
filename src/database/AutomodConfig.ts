import mongoose from 'mongoose'

export interface IAutomodConfig extends mongoose.Document {
    guildId: string
    enabled: boolean
    muteRoleId?: string
    whitelistedChannels: string[]
    whitelistedRoles: string[]
    autoFindMuteRole: boolean
    createdAt: Date
    updatedAt: Date
}

export interface IAutomodRule extends mongoose.Document {
    guildId: string
    type: 'attachment_spam' | 'bad_words' | 'caps' | 'invites' | 'spam'
    enabled: boolean
    threshold?: number
    punishment: 'warn' | 'mute' | 'kick' | 'ban' | 'temp_mute' | 'temp_ban'
    duration?: number
    warningsBeforeAction?: number
    blacklist?: string[]
    createdAt: Date
    updatedAt: Date
}

const Schema = mongoose.Schema

const automodConfigSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    muteRoleId: {
        type: String,
        default: null
    },
    whitelistedChannels: [{
        type: String
    }],
    whitelistedRoles: [{
        type: String
    }],
    autoFindMuteRole: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'automodconfigs' })

const automodRuleSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: ['attachment_spam', 'bad_words', 'caps', 'invites', 'spam']
    },
    enabled: {
        type: Boolean,
        default: false
    },
    threshold: {
        type: Number,
        default: null
    },
    punishment: {
        type: String,
        required: true,
        enum: ['warn', 'mute', 'kick', 'ban', 'temp_mute', 'temp_ban'],
        default: 'warn'
    },
    duration: {
        type: Number,
        default: null
    },
    warningsBeforeAction: {
        type: Number,
        default: 3
    },
    blacklist: [{
        type: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'automodrules' })

automodRuleSchema.index({ guildId: 1, type: 1 }, { unique: true })

automodConfigSchema.pre('save', function(next) {
    this.updatedAt = new Date()
    next()
})

automodRuleSchema.pre('save', function(next) {
    this.updatedAt = new Date()
    next()
})

const AutomodConfig = mongoose.model<IAutomodConfig>('AutomodConfig', automodConfigSchema)
const AutomodRule = mongoose.model<IAutomodRule>('AutomodRule', automodRuleSchema)

export { AutomodConfig, AutomodRule }
export default AutomodConfig