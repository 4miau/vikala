import mongoose, { Mixed } from 'mongoose'

export interface ISettings extends mongoose.Document {
	id: string
	settings: Mixed
}

const Schema = mongoose.Schema
const settingsSchema = new Schema(
	{
		id: {
			type: String,
			unique: true,
			required: true
		},
		settings: {
			type: Schema.Types.Mixed,
			required: true
		}
	},
	{ collection: 'settings' }
)

const Settings = mongoose.model<ISettings>('settings', settingsSchema)

export default Settings
