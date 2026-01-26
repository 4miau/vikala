import { model, Schema, Model, Document } from 'mongoose'

export interface IChannelSnapshot extends Document {
	channelId: string
	guildId: string
	name: string
	type: number
	categoryId?: string
	topic?: string
	position: number
	nsfw: boolean
	createdAt: Date
	deletedAt?: Date
	lastSeen: Date
}

const ChannelSnapshotSchema = new Schema<IChannelSnapshot>({
	channelId: {
		type: String,
		required: true,
		index: true
	},
	guildId: {
		type: String,
		required: true,
		index: true
	},
	name: {
		type: String,
		required: true
	},
	type: {
		type: Number,
		required: true
	},
	categoryId: {
		type: String,
		required: false
	},
	topic: {
		type: String,
		required: false
	},
	position: {
		type: Number,
		required: true
	},
	nsfw: {
		type: Boolean,
		default: false
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	deletedAt: {
		type: Date,
		required: false
	},
	lastSeen: {
		type: Date,
		default: Date.now
	}
})

ChannelSnapshotSchema.index({ channelId: 1, guildId: 1 }, { unique: true })

export default model<IChannelSnapshot>('ChannelSnapshot', ChannelSnapshotSchema, 'channelsnapshots')
