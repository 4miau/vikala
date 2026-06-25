import { model, Schema, Document } from 'mongoose'

export interface IReminder extends Document {
	reminderId: string
	userId: string
	guildId: string | null
	channelId: string | null
	message: string
	triggerAt: Date
	createdAt: Date
	repeat: string | null
	subscribedFrom: string | null
}

const ReminderSchema = new Schema<IReminder>(
	{
		reminderId: { type: String, required: true, unique: true, index: true },
		userId: { type: String, required: true, index: true },
		guildId: { type: String, default: null },
		channelId: { type: String, default: null },
		message: { type: String, required: true },
		triggerAt: { type: Date, required: true, index: true },
		createdAt: { type: Date, default: Date.now },
		repeat: { type: String, default: null },
		subscribedFrom: { type: String, default: null }
	},
	{ collection: 'reminders' }
)

export default model<IReminder>('Reminder', ReminderSchema)
