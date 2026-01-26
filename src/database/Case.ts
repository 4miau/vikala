import mongoose from 'mongoose'

declare type extrasType = {
	reason: string
	logMessageId: string
	actionDuration: Date
	actionComplete: boolean
}

export interface ICase extends mongoose.Document {
	id: number
	guildId: string
	messageId: string
	caseId: number
	targetId: string
	targetUsername: string
	action: string
	modId: string
	modUsername: string
	actionDuration: Date
	actionComplete: boolean
	createdAt: Date
	extras: extrasType
}

const Schema = mongoose.Schema
const caseSchema = new Schema(
	{
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
		messageId: {
			type: String,
			required: false
		},
		caseId: {
			type: Number,
			required: true,
			index: true
		},
		targetId: {
			type: String,
			required: true,
			index: true
		},
		targetUsername: {
			type: String,
			required: true
		},
		action: {
			type: String,
			required: true
		},
		modId: {
			type: String,
			required: false
		},
		modUsername: {
			type: String,
			required: false
		},
		createdAt: {
			type: Date,
			default: Date.now
		},
		extras: {
			type: {
				reason: String,
				logMessageId: String,
				actionDuration: Date,
				actionComplete: Boolean
			},
			default: {
				reason: 'No reason specified',
				logMessageId: '',
				actionDuration: null,
				actionComplete: true
			}
		}
	},
	{ timestamps: true }
)

const Case = mongoose.model<ICase>('case', caseSchema)

export default Case
