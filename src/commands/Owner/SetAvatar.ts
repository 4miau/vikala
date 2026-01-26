import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'
import { yes } from '../../lib/util/utilities'

@ApplyOptions<Command.Options>({
	name: 'setavatar',
	aliases: ['setavi'],
	description: 'Sets my new avatar image.',
	usage: 'setavatar <image>',
	examples: [{ example: 'setavatar https://example.com/avatar.png', description: 'Sets my new avatar image to the provided URL.' }],
	preconditions: ['OwnerOnly']
})
export class SetAvatar extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const img = await args.pickResult('hyperlink').then((img) => (!img.isErr ? img.unwrap().href : null))
		const attachment = message.attachments?.first()

		if (!img && !attachment.size) return message.channel.send({ content: 'You must provide an image URL or attach an image to set as my avatar.' })

		const filter = (msg: Message) => msg.author.id === message.author.id
		const reply = (await message.channel.awaitMessages({ filter: filter, max: 1, time: 30000 })).first()?.content

		if (!reply || !yes(reply)) {
			try {
				await this.client.user.setAvatar(img ? img : attachment.url)
				return message.channel.send({ content: 'Successfully updated my avatar!' })
			} catch {
				return message.channel.send({ content: 'Avatar update failed.' })
			}
		}
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const img = interaction.options.getAttachment('image', true)

		try {
			await this.client.user.setAvatar(img.url)
			return interaction.reply({ content: 'Successfully updated my avatar!', flags: ['Ephemeral'] })
		} catch {
			return interaction.reply({ content: 'Avatar update failed.', flags: ['Ephemeral'] })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('setavatar')
				.setDescription('Sets my new avatar image.')
				.addAttachmentOption((option) =>
					option
						.setName('image')
						.setDescription('The image to set as my new avatar.')
						.setRequired(true)
				)
		)
	}
}
