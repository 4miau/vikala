import { model, Schema, Model, Document } from 'mongoose'

export interface IThread extends Document {
	threadId: string
	guildId: string
	userId: string
	channelId: string
	status: 'open' | 'closed'
	closedBy?: string
	userAnonymous: boolean
	createdAt: Date
	closedAt?: Date
	messages: {
		authorId: string
		authorTag: string
		content: string
		timestamp: Date
		attachments: string[]
		isStaff: boolean
	}[]
}

const ThreadSchema = new Schema<IThread>({
	threadId: {
		type: String,
		required: true,
		unique: true
	},
	guildId: {
		type: String,
		required: true
	},
	userId: {
		type: String,
		required: true
	},
	channelId: {
		type: String,
		required: true
	},
	status: {
		type: String,
		enum: ['open', 'closed'],
		default: 'open'
	},
	closedBy: {
		type: String
	},
	userAnonymous: {
		type: Boolean,
		default: false
	},
	createdAt: {
		type: Date,
		default: Date.now
	},
	closedAt: {
		type: Date
	},
	messages: [
		{
			authorId: {
				type: String,
				required: true
			},
			authorTag: {
				type: String,
				required: true
			},
			content: {
				type: String,
				required: true
			},
			timestamp: {
				type: Date,
				default: Date.now
			},
			attachments: [
				{
					type: String
				}
			],
			isStaff: {
				type: Boolean,
				default: false
			}
		}
	]
})

const Thread: Model<IThread> = model<IThread>('Thread', ThreadSchema, 'threads')

export default Thread
