import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/pieces'
import { Message, Role, TextChannel } from 'discord.js'

import Task from '../../lib/mods/Task'

interface RoleMenuSetupData {
	groupName: string
	targetChannel?: TextChannel
	targetMessageId?: string
	roles: { role: Role; emoji?: string }[]
	currentRoleIndex: number
	totalRoles: number
	menuMessage?: Message
	setupMessage?: Message
	assignedRoles: { role: Role; emoji: string }[]
}

@ApplyOptions<Piece.Options>({ name: 'rolemenuwizard' })
export class RoleMenuWizardTask extends Task {
	private client = this.container.client

	public async exec(message: Message, groupName: string, targetChannel?: TextChannel, targetMessageId?: string): Promise<boolean> {
		if (!message.guild || !message.channel.isSendable()) return false

		const group = await this.client.roleGroups.getGroup(message.guild.id, groupName)
		if (!group) {
			await message.channel.send(`❌ Role group **${groupName}** not found.`)
			return false
		}

		const groupRoles = await this.client.roleGroups.getGroupRoles(message.guild.id, groupName)
		if (groupRoles.length === 0) {
			await message.channel.send(`❌ Role group **${groupName}** has no roles. Add roles first with \`rg addrole\`.`)
			return false
		}

		const setupData: RoleMenuSetupData = {
			groupName,
			targetChannel,
			targetMessageId,
			roles: groupRoles
				.map((gr) => ({
					role: message.guild!.roles.cache.get(gr.roleId)!,
					emoji: gr.emoji
				}))
				.filter((r) => r.role),
			currentRoleIndex: 0,
			totalRoles: groupRoles.filter((gr) => message.guild!.roles.cache.get(gr.roleId)).length,
			assignedRoles: []
		}

		return await this.startSetup(message, setupData)
	}

	private async startSetup(message: Message, data: RoleMenuSetupData): Promise<boolean> {
		const targetChannel = data.targetChannel || (message.channel as TextChannel)

		if (data.targetMessageId) {
			try {
				const existingMessage = await targetChannel.messages.fetch(data.targetMessageId)
				data.menuMessage = existingMessage
			} catch {
				if (message.channel.isSendable()) {
					await message.channel.send(`❌ Could not find message with ID \`${data.targetMessageId}\`.`)
				}
				return false
			}
		} else {
			const menuText = `Role menu: ${data.groupName}\nSetting up...`
			data.menuMessage = await targetChannel.send(menuText)
		}

		const setupText = `Rolemenu setup: [0/${data.totalRoles}]\nReact with the emoji for the role command: \`${data.roles[0]?.role.name}\`\nNote: The bot has to be on the server where the emoji is from, otherwise it won't be able to use it\n\nThis message will be updated with new info throughout the setup.`

		if (!message.channel.isSendable()) return false
		data.setupMessage = await message.channel.send(setupText)

		return await this.processNextRole(message, data)
	}

	private async processNextRole(message: Message, data: RoleMenuSetupData): Promise<boolean> {
		if (data.currentRoleIndex >= data.roles.length) {
			return await this.finalizeSetup(message, data)
		}

		const currentRole = data.roles[data.currentRoleIndex]

		try {
			const collector = data.setupMessage!.createReactionCollector({
				filter: (_, user) => !user.bot && user.id === message.author.id,
				max: 1,
				time: 120000
			})

			return new Promise((resolve) => {
				collector.on('collect', async (reaction) => {
					const emojiString = this.client.roleGroups.getEmojiString(reaction)

					await this.client.roleGroups.setRoleEmoji(message.guild!.id, data.groupName, currentRole.role.id, emojiString)

					data.assignedRoles.push({ role: currentRole.role, emoji: emojiString })

					if (!data.targetMessageId) {
						await this.updateMenuMessage(data)
					}

					try {
						await reaction.users.remove(message.author.id)
					} catch {}

					data.currentRoleIndex++

					if (data.currentRoleIndex < data.roles.length) {
						const nextRole = data.roles[data.currentRoleIndex]
						const setupText = `Rolemenu setup: [${data.currentRoleIndex}/${data.totalRoles}]\nReact with the emoji for the role command: \`${nextRole.role.name}\`\nNote: The bot has to be on the server where the emoji is from, otherwise it won't be able to use it\n\nThis message will be updated with new info throughout the setup.`
						await data.setupMessage!.edit(setupText)
					}

					resolve(await this.processNextRole(message, data))
				})

				collector.on('end', (collected, reason) => {
					if (reason === 'time' && collected.size === 0) {
						resolve(false)
					}
				})
			})
		} catch (error) {
			console.error('Role emoji setup error:', error)
			return false
		}
	}

	private async updateMenuMessage(data: RoleMenuSetupData): Promise<void> {
		if (!data.menuMessage) return

		const rolesList = data.assignedRoles
			.map((r) => {
				let displayEmoji = r.emoji
				if (r.emoji.startsWith('<:') && r.emoji.endsWith('>')) {
					displayEmoji = r.emoji
				} else if (r.emoji.match(/^\d+$/)) {
					const guildEmoji = data.menuMessage!.guild?.emojis.cache.get(r.emoji)
					if (guildEmoji) {
						displayEmoji = `<:${guildEmoji.name}:${guildEmoji.id}>`
					}
				}
				return `${displayEmoji} : \`${r.role.name}\``
			})
			.join('\n')
		const menuText = `Role menu: ${data.groupName}\nReact to give yourself a role.\n\n${rolesList}`

		try {
			await data.menuMessage.edit(menuText)
		} catch (error) {
			console.warn('Failed to update menu message:', error)
		}
	}

	private async finalizeSetup(message: Message, data: RoleMenuSetupData): Promise<boolean> {
		try {
			const targetChannel = data.targetChannel || (message.channel as TextChannel)

			const existingMenu = await this.client.roleGroups.getMenu(message.guild!.id, data.groupName)
			const disableDMs = existingMenu?.disableDMs ?? false
			const allowRoleRemoval = existingMenu?.allowRoleRemoval ?? true

			await this.client.roleGroups.createMenu(message.guild!.id, {
				groupName: data.groupName,
				channelId: targetChannel.id,
				messageId: data.menuMessage!.id,
				title: `${data.groupName} Roles`,
				description: `React to get roles from the ${data.groupName} group.`,
				disableDMs,
				allowRoleRemoval
			})

			for (const roleData of data.assignedRoles) {
				try {
					await data.menuMessage!.react(roleData.emoji)
				} catch (error) {
					console.warn(`Failed to add reaction ${roleData.emoji}:`, error)
				}
			}

			const flagsText = `Done setting up! You can delete all the messages now (except for the menu itself)\n\nFlags:\n\`-nodm: ${disableDMs ? 'true' : 'false'}\` toggle with \`rolemenu update ${data.menuMessage!.id} --nodm\`\n\`-rr: ${allowRoleRemoval ? 'true' : 'false'}\` toggle with \`rolemenu update ${data.menuMessage!.id} --rr\``

			if (data.setupMessage) {
				await data.setupMessage.edit(flagsText)
			}

			return true
		} catch (error) {
			console.error('Menu finalization error:', error)
			return false
		}
	}
}
