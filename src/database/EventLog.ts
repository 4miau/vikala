import mongoose from 'mongoose'

declare type EventExtrasType = {
    channelId?: string
    content?: string
    beforeContent?: string
    afterContent?: string
    messageId?: string
    changes?: string
}

export interface IEventLog extends mongoose.Document {
    id: number
    guildId: string
    caseId: number
    eventType: EventActions
    targetId?: string
    targetName?: string
    createdAt: Date
    extras: EventExtrasType
}

const Schema = mongoose.Schema
const eventLogSchema = new Schema({
    id: {
        type: Number,
        unique: true,
        required: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    caseId: {
        type: Number,
        required: true,
        index: true
    },
    eventType: {
        type: String,
        required: true
    },
    targetId: {
        type: String,
        required: false
    },
    targetName: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    extras: {
        type: {
            channelId: String,
            content: String,
            beforeContent: String,
            afterContent: String,
            messageId: String,
            changes: String
        },
        default: {
            channelId: null,
            content: null,
            beforeContent: null,
            afterContent: null,
            messageId: null,
            changes: null
        }
    }
}, { timestamps: true })

eventLogSchema.index({ guildId: 1, id: -1 })

const EventLog = mongoose.model<IEventLog>('eventlog', eventLogSchema)

export default EventLog