import mongoose from 'mongoose'

export interface IRoleReward extends mongoose.Document {
	guildId: string
	level: number
	roleId: string
	isStackable: boolean
	createdAt: Date
}

const Schema = mongoose.Schema
const roleRewardSchema = new Schema(
	{
		guildId: {
			type: String,
			required: true
		},
		level: {
			type: Number,
			required: true
		},
		roleId: {
			type: String,
			required: true
		},
		isStackable: {
			type: Boolean,
			default: true
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	},
	{ collection: 'rolerewards' }
)

roleRewardSchema.index({ guildId: 1, level: 1 })
roleRewardSchema.index({ guildId: 1, roleId: 1 }, { unique: true })

const RoleReward = mongoose.model<IRoleReward>('RoleReward', roleRewardSchema)

export default RoleReward
