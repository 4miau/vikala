import { ApplyOptions } from '@sapphire/decorators'
import { Piece } from '@sapphire/pieces'
import { EmbedBuilder, Message, Role } from 'discord.js'

import Task from '../../lib/mods/Task'
import { Colors } from '../../lib/util/Colors'
import ms from 'ms'

@ApplyOptions<Piece.Options>({ name: 'roleemojisetup' })
export class RoleEmojiSetupTask extends Task {
	client = this.container.client

	public async exec(message: Message, groupName: string, role: Role): Promise<boolean> {
		if (!message.guild || !message.channel.isSendable()) return false

		const embed = new EmbedBuilder()
			.setTitle('🎭 Set Emoji for Role')
			.setDescription(
				`**Role:** ${role.name}\n**Group:** ${groupName}\n\n**React to this message with the emoji you want to use for this role.**\n\nThe bot will automatically detect your reaction and assign that emoji to the role.`
			)
			.setColor(Colors.Blurple)
			.setFooter({ text: 'React with any emoji - no suggestions needed!' })

		const setupMessage = await message.channel.send({ embeds: [embed] })

		try {
			const collector = setupMessage.createReactionCollector({
				filter: (_, user) => !user.bot && user.id === message.author.id,
				max: 1,
				time: ms('60s')
			})

			return new Promise((resolve) => {
				collector.on('collect', async (reaction) => {
					const emojiString = this.client.roleGroups.getEmojiString(reaction)

					try {
						await this.client.roleGroups.setRoleEmoji(message.guild!.id, groupName, role.id, emojiString)

						const successEmbed = new EmbedBuilder()
							.setTitle('✅ Emoji Set Successfully!')
							.setDescription(
								`**Role:** ${role.name}\n**Emoji:** ${emojiString}\n**Group:** ${groupName}\n\nUsers can now react with ${emojiString} to get the ${role.name} role!`
							)
							.setColor(Colors.Green)

						await setupMessage.edit({ embeds: [successEmbed] })
						resolve(true)
					} catch (error) {
						console.error('Failed to set role emoji:', error)

						const errorEmbed = new EmbedBuilder()
							.setTitle('❌ Failed to Set Emoji')
							.setDescription(`Could not set emoji ${emojiString} for role ${role.name}.\n\nPlease try again.`)
							.setColor(Colors.Red)

						await setupMessage.edit({ embeds: [errorEmbed] })
						resolve(false)
					}
				})

				collector.on('end', (collected, reason) => {
					if (reason === 'time' && collected.size === 0) {
						const timeoutEmbed = new EmbedBuilder()
							.setTitle('⏰ Setup Timed Out')
							.setDescription(`No reaction detected within 60 seconds.\n\nRun the command again to set an emoji for ${role.name}.`)
							.setColor(Colors.Orange)

						setupMessage.edit({ embeds: [timeoutEmbed] })
						resolve(false)
					}
				})
			})
		} catch {
			await setupMessage.edit({
				embeds: [
					new EmbedBuilder()
						.setTitle('❌ Setup Failed')
						.setDescription('An error occurred during emoji setup. Please try again.')
						.setColor(Colors.Red)
				]
			})
			return false
		}
	}
}
