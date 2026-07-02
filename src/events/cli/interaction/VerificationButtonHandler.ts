import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Interaction, ButtonInteraction } from 'discord.js'

@ApplyOptions<Listener.Options>({
	event: Events.InteractionCreate
})
export class EventListener extends Listener {
	private client = this.container.client

	public override async run(interaction: Interaction) {
		if (!interaction.isButton()) return

		const buttonInteraction = interaction as ButtonInteraction
		if (buttonInteraction.customId !== 'verify_button') return

		await this.client.verification.handleVerify(buttonInteraction)
	}
}
