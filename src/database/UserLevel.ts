import mongoose from 'mongoose'

export interface IUserLevel extends mongoose.Document {
    userId: string
    guildId: string
    level: number
    xp: number
    totalXp: number
    lastXpGain: Date
    messageCount: number
    createdAt: Date
    updatedAt: Date
}

const Schema = mongoose.Schema
const userLevelSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true,
        unique: true
    },
    guildId: {
        type: String,
        required: true,
        index: true,
        unique: true
    },
    level: {
        type: Number,
        default: 0
    },
    xp: {
        type: Number,
        default: 0
    },
    totalXp: {
        type: Number,
        default: 0
    },
    lastXpGain: {
        type: Date,
        default: Date.now
    },
    messageCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'userlevels', timestamps: true })

userLevelSchema.index({ guildId: 1, level: -1, xp: -1 })

const UserLevel = mongoose.model<IUserLevel>('UserLevel', userLevelSchema)

export default UserLevel