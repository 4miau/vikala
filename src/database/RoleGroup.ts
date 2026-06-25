import mongoose from 'mongoose'

export interface IRoleGroup extends mongoose.Document {
	guildId: string
	name: string
	mode: 'single' | 'multiple' | 'limited'
	minRoles?: number
	maxRoles?: number
	requiredRoles?: string[]
	ignoredRoles?: string[]
	removeRoles?: string[]
	temporaryDuration?: number
	enabled: boolean
	createdAt: Date
	updatedAt: Date
}

export interface IGroupRole extends mongoose.Document {
	groupId: mongoose.Types.ObjectId
	guildId: string
	roleId: string
	emoji?: string
	emojiId?: string
	emojiName?: string
	position: number
	enabled: boolean
	createdAt: Date
}

export interface IRoleMenu extends mongoose.Document {
	groupId: mongoose.Types.ObjectId
	guildId: string
	channelId: string
	messageId: string
	title: string
	description: string
	groupName: string
	disableDMs: boolean
	allowRoleRemoval: boolean
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

const roleGroupSchema = new Schema(
	{
		guildId: {
			type: String,
			required: true,
			index: true
		},
		name: {
			type: String,
			required: true
		},
		mode: {
			type: String,
			enum: ['single', 'multiple', 'limited'],
			required: true
		},
		minRoles: {
			type: Number,
			min: 0
		},
		maxRoles: {
			type: Number,
			min: 1
		},
		requiredRoles: [
			{
				type: String
			}
		],
		ignoredRoles: [
			{
				type: String
			}
		],
		removeRoles: [
			{
				type: String
			}
		],
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
		},
		updatedAt: {
			type: Date,
			default: Date.now
		}
	},
	{ collection: 'rolegroups' }
)

const groupRoleSchema = new Schema(
	{
		groupId: {
			type: mongoose.Types.ObjectId,
			ref: 'RoleGroup',
			required: true,
			index: true
		},
		guildId: {
			type: String,
			required: true,
			index: true
		},
		roleId: {
			type: String,
			required: true
		},
		emoji: {
			type: String
		},
		emojiId: {
			type: String
		},
		emojiName: {
			type: String
		},
		position: {
			type: Number,
			default: 0
		},
		enabled: {
			type: Boolean,
			default: true
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	},
	{ collection: 'grouproles' }
)

const roleMenuSchema = new Schema(
	{
		groupId: {
			type: mongoose.Types.ObjectId,
			ref: 'RoleGroup',
			required: true,
			index: true
		},
		guildId: {
			type: String,
			required: true,
			index: true
		},
		channelId: {
			type: String,
			required: true
		},
		messageId: {
			type: String,
			required: true,
			index: true
		},
		title: {
			type: String,
			required: true
		},
		description: {
			type: String,
			required: true
		},
		groupName: {
			type: String,
			required: true,
			index: true
		},
		disableDMs: {
			type: Boolean,
			default: false
		},
		allowRoleRemoval: {
			type: Boolean,
			default: true
		},
		createdAt: {
			type: Date,
			default: Date.now
		}
	},
	{ collection: 'rolemenus' }
)

const temporaryRoleSchema = new Schema(
	{
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
	},
	{ collection: 'temporaryroles' }
)

roleGroupSchema.index({ guildId: 1, name: 1 }, { unique: true })
groupRoleSchema.index({ groupId: 1, roleId: 1 }, { unique: true })
roleMenuSchema.index({ guildId: 1, messageId: 1 }, { unique: true })
temporaryRoleSchema.index({ guildId: 1, userId: 1, roleId: 1 })

roleGroupSchema.pre('save', function (this: IRoleGroup) {
	this.updatedAt = new Date()
})

const RoleGroup = mongoose.model<IRoleGroup>('RoleGroup', roleGroupSchema)
const GroupRole = mongoose.model<IGroupRole>('GroupRole', groupRoleSchema)
const RoleMenu = mongoose.model<IRoleMenu>('RoleMenu', roleMenuSchema)
const TemporaryRole = mongoose.model<ITemporaryRole>('TemporaryRole', temporaryRoleSchema)

export { RoleGroup, GroupRole, RoleMenu, TemporaryRole }
export default RoleGroup
