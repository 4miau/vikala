import mongoose from 'mongoose'

export interface IReactionRole extends mongoose.Document {
    guildId: string
    messageId: string
    channelId: string
    emoji: string
    roleId: string
    type: 'normal' | 'unique' | 'verify' | 'temporary'
    groupId?: string
    maxUses?: number
    currentUses: number
    requiresRole?: string[]
    excludeRoles?: string[]
    temporaryDuration?: number
    enabled: boolean
    createdAt: Date
}

export interface ITemporaryRole extends mongoose.Document {
    guildId: string
    userId: string
    roleId: string
    reactionRoleId: string
    expiresAt: Date
    assignedAt: Date
}

const Schema = mongoose.Schema

const reactionRoleSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    messageId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true
    },
    emoji: {
        type: String,
        required: true
    },
    roleId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['normal', 'unique', 'verify', 'temporary'],
        default: 'normal'
    },
    groupId: {
        type: String,
        required: false
    },
    maxUses: {
        type: Number,
        required: false
    },
    currentUses: {
        type: Number,
        default: 0
    },
    requiresRole: [{
        type: String
    }],
    excludeRoles: [{
        type: String
    }],
    temporaryDuration: {
        type: Number,
        required: false
    },
    enabled: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'reactionroles' })

const temporaryRoleSchema = new Schema({
    guildId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    roleId: {
        type: String,
        required: true,
        index: true
    },
    reactionRoleId: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    assignedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'temporaryroles' })

reactionRoleSchema.index({ guildId: 1, messageId: 1, emoji: 1 }, { unique: true })
temporaryRoleSchema.index({ guildId: 1, userId: 1, roleId: 1 })

const ReactionRole = mongoose.model<IReactionRole>('ReactionRole', reactionRoleSchema)
const TemporaryRole = mongoose.model<ITemporaryRole>('TemporaryRole', temporaryRoleSchema)

export { ReactionRole, TemporaryRole }
export default ReactionRole