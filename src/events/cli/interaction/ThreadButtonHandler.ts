import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Interaction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { Colors } from '../../../lib/util/Colors'

@ApplyOptions<Listener.Options>({
	event: Events.InteractionCreate
})
export class EventListener extends Listener {
	client = this.container.client

	public override async run(interaction: Interaction) {
		if (!interaction.isButton()) return

		const buttonInteraction = interaction as ButtonInteraction
		const { customId } = buttonInteraction

		if (customId === 'create_thread') {
			const embed = this.client.threads.getAnonymousPromptEmbed()
			const row = this.client.threads.getAnonymousPromptButtons()
			await buttonInteraction.reply({ embeds: [embed], components: [row], flags: ['Ephemeral'] })
		}

		if (customId === 'create_thread_regular' || customId === 'create_thread_anonymous') {
			await buttonInteraction.deferUpdate()
			const isAnonymous = customId === 'create_thread_anonymous'

			const thread = await this.client.threads.createThread(buttonInteraction.guild, buttonInteraction.user, isAnonymous)

			if (thread) {
				await buttonInteraction.editReply({ content: '✅ Modmail thread created! Please check your DMs.' })
			} else {
				await buttonInteraction.editReply({ content: '❌ Failed to create thread. You may already have an active thread or be blacklisted.' })
			}
		}

		if (customId.startsWith('thread_close_') || customId.startsWith('user_close_')) {
			await buttonInteraction.deferReply({ flags: ['Ephemeral'] })

			const threadId = customId.replace('thread_close_', '').replace('user_close_', '')
			const isUserClose = customId.startsWith('user_close_')

			await this.client.threads.closeThread(threadId, buttonInteraction.user.tag, isUserClose ? 'Closed by user' : 'Closed via button')

			await buttonInteraction.editReply({ content: '✅ Thread closed successfully.' })
		}
	}
}
