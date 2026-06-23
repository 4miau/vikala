import mongoose from 'mongoose'

export interface IChangelog extends mongoose.Document {
	id: number
	version?: string
	title: string
	description: string
	category: 'feature' | 'bugfix' | 'improvement' | 'breaking' | 'other'
	createdBy: string
	createdByUsername: string
	createdAt: Date
}

const Schema = mongoose.Schema
const changelogSchema = new Schema(
	{
		id: {
			type: Number,
			unique: true,
			required: true
		},
		version: {
			type: String,
			required: false
		},
		title: {
			type: String,
			required: true
		},
		description: {
			type: String,
			required: true
		},
		category: {
			type: String,
			required: true,
			enum: ['feature', 'bugfix', 'improvement', 'breaking', 'other']
		},
		createdBy: {
			type: String,
			required: true
		},
		createdByUsername: {
			type: String,
			required: true
		},
		createdAt: {
			type: Date,
			default: Date.now,
			required: true
		}
	},
	{ collection: 'changelogs' }
)

const Changelog = mongoose.model<IChangelog>('changelogs', changelogSchema)

export default Changelog
