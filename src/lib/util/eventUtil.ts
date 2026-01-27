import { GuildChannel, Role, PermissionsBitField } from 'discord.js'
import { arrayEmpty } from 'miau-utilities'

export function compareRoleChanges(oldRole: Role, newRole: Role): string | null {
	const changes: string[] = []

	if (oldRole.name !== newRole.name) changes.push(`• **Name:** \`${oldRole.name}\` → \`${newRole.name}\``)

	if (oldRole.color !== newRole.color) {
		const oldColor = oldRole.color === 0 ? 'Default' : `#${oldRole.color.toString(16).padStart(6, '0').toUpperCase()}`
		const newColor = newRole.color === 0 ? 'Default' : `#${newRole.color.toString(16).padStart(6, '0').toUpperCase()}`
		changes.push(`• **Color:** ${oldColor} → ${newColor}`)
	}

	if (oldRole.mentionable !== newRole.mentionable) {
		const oldMentionable = oldRole.mentionable ? 'Yes' : 'No'
		const newMentionable = newRole.mentionable ? 'Yes' : 'No'
		changes.push(`• **Mentionable:** ${oldMentionable} → ${newMentionable}`)
	}

	if (oldRole.hoist !== newRole.hoist) {
		const oldHoist = oldRole.hoist ? 'Yes' : 'No'
		const newHoist = newRole.hoist ? 'Yes' : 'No'
		changes.push(`• **Display Separately:** ${oldHoist} → ${newHoist}`)
	}

	const oldPerms = oldRole.permissions.toArray()
	const newPerms = newRole.permissions.toArray()

	const addedPerms = newPerms.filter((perm) => !oldPerms.includes(perm))
	const removedPerms = oldPerms.filter((perm) => !newPerms.includes(perm))

	if (addedPerms.length > 0) {
		const permNames = addedPerms.map((perm) => formatPermissionName(perm)).join(', ')
		changes.push(`• **Permissions Added:** ${permNames}`)
	}

	if (removedPerms.length > 0) {
		const permNames = removedPerms.map((perm) => formatPermissionName(perm)).join(', ')
		changes.push(`• **Permissions Removed:** ${permNames}`)
	}

	if (arrayEmpty(changes)) return null

	return `**📝 Changes:**\n${changes.join('\n')}`
}

export function compareChannelChanges(oldChannel: GuildChannel, newChannel: GuildChannel): string | null {
	const changes: string[] = []

	if (oldChannel.name !== newChannel.name) changes.push(`• **Name:** \`${oldChannel.name}\` → \`${newChannel.name}\``)

	const oldOverwrites = oldChannel.permissionOverwrites.cache
	const newOverwrites = newChannel.permissionOverwrites.cache

	const permissionChanges: string[] = []

	newOverwrites.forEach((newOverwrite, id) => {
		const oldOverwrite = oldOverwrites.get(id)
		const target = newOverwrite.type === 0 ? `<@&${id}>` : `<@${id}>`

		if (!oldOverwrite) {
			const allows = new PermissionsBitField(newOverwrite.allow).toArray()
			const denies = new PermissionsBitField(newOverwrite.deny).toArray()

			if (allows.length > 0) {
				const allowNames = allows.map((perm) => formatPermissionName(perm)).join(', ')
				permissionChanges.push(`• ${target} gained: ${allowNames}`)
			}
			if (denies.length > 0) {
				const denyNames = denies.map((perm) => formatPermissionName(perm)).join(', ')
				permissionChanges.push(`• ${target} denied: ${denyNames}`)
			}
		} else {
			const oldAllow = new PermissionsBitField(oldOverwrite.allow).toArray()
			const newAllow = new PermissionsBitField(newOverwrite.allow).toArray()
			const oldDeny = new PermissionsBitField(oldOverwrite.deny).toArray()
			const newDeny = new PermissionsBitField(newOverwrite.deny).toArray()

			const addedAllows = newAllow.filter((perm) => !oldAllow.includes(perm))
			const removedAllows = oldAllow.filter((perm) => !newAllow.includes(perm))
			const addedDenies = newDeny.filter((perm) => !oldDeny.includes(perm))
			const removedDenies = oldDeny.filter((perm) => !newDeny.includes(perm))

			if (addedAllows.length > 0) {
				const permNames = addedAllows.map((perm) => formatPermissionName(perm)).join(', ')
				permissionChanges.push(`• ${target} gained: ${permNames}`)
			}
			if (removedAllows.length > 0) {
				const permNames = removedAllows.map((perm) => formatPermissionName(perm)).join(', ')
				permissionChanges.push(`• ${target} lost: ${permNames}`)
			}
			if (addedDenies.length > 0) {
				const permNames = addedDenies.map((perm) => formatPermissionName(perm)).join(', ')
				permissionChanges.push(`• ${target} denied: ${permNames}`)
			}
			if (removedDenies.length > 0) {
				const permNames = removedDenies.map((perm) => formatPermissionName(perm)).join(', ')
				permissionChanges.push(`• ${target} no longer denied: ${permNames}`)
			}
		}
	})

	oldOverwrites.forEach((oldOverwrite, id) => {
		if (!newOverwrites.has(id)) {
			const target = oldOverwrite.type === 0 ? `<@&${id}>` : `<@${id}>`
			permissionChanges.push(`• ${target} permissions removed`)
		}
	})

	if (permissionChanges.length > 0) {
		changes.push(`**Permissions:**\n${permissionChanges.join('\n')}`)
	}

	if (arrayEmpty(changes)) return null

	return `**📝 Changes:**\n${changes.join('\n')}`
}

export function compareMemberChanges(oldMember: import('discord.js').GuildMember, newMember: import('discord.js').GuildMember): string | null {
	const changes: string[] = []

	if (oldMember.nickname !== newMember.nickname) {
		const oldNick = oldMember.nickname || oldMember.user.username
		const newNick = newMember.nickname || newMember.user.username
		changes.push(`**Nickname:** \`${oldNick}\` → \`${newNick}\``)
	}

	if (arrayEmpty(changes)) return null

	return `**📝 Changes:**\n${changes.join('\n')}`
}

export function compareUserChanges(oldUser: import('discord.js').User, newUser: import('discord.js').User): string | null {
	const changes: string[] = []

	if (oldUser.username !== newUser.username) {
		changes.push(`**Username:** \`${oldUser.username}\` → \`${newUser.username}\``)
	}

	if (oldUser.avatar !== newUser.avatar) {
		const oldAvatar = oldUser.avatar ? `[Avatar](${oldUser.displayAvatarURL({ size: 256 })})` : 'No Avatar'
		const newAvatar = newUser.avatar ? `[Avatar](${newUser.displayAvatarURL({ size: 256 })})` : 'No Avatar'
		changes.push(`**Avatar:** ${oldAvatar} → ${newAvatar}`)
	}

	if (arrayEmpty(changes)) return null

	return `**📝 Changes:**\n${changes.join('\n')}`
}

function formatPermissionName(permission: string): string {
	return permission
		.split('_')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')
}
