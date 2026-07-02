import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Guild, Message, TextChannel } from 'discord.js'
import { Subcommand } from '@sapphire/plugin-subcommands'

@ApplyOptions<Subcommand.Options>({
	name: 'createinvite',
	aliases: ['newinvite'],
	description: 'Creates an invite link for a server',
	usage: 'createinvite <new|existing>',
	examples: [
		{ example: 'createinvite new', description: 'Creates a new invite link for the server.' },
		{ example: 'createinvite existing', description: 'Fetches an existing invite link for the server.' }
	],
	preconditions: ['OwnerOnly'],
	subcommands: [
		{ name: 'new', messageRun: 'newMsgInvite', chatInputRun: 'newChatInvite', default: true },
		{ name: 'existing', messageRun: 'existingMsgInvite', chatInputRun: 'existingChatInvite' }
	]
})
export class CreateInvite extends Subcommand {
	private client = this.container.client

	public async newMsgInvite(message: Message) {
		if (!message.channel.isSendable()) return
		return this.handleCreateInvite(message.guild, message.channel.id, (content) => (message.channel as TextChannel).send(content))
	}

	public async newChatInvite(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.handleCreateInvite(interaction.guild, interaction.channelId, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
	}

	public async existingMsgInvite(message: Message) {
		if (!message.channel.isSendable()) return
		return this.handleGetExistingInvite(message.guild, (content) => (message.channel as TextChannel).send(content))
	}

	public async existingChatInvite(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.handleGetExistingInvite(interaction.guild, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
	}

	private async handleCreateInvite(guild: Guild, channelId: string, sendFn: (content: any) => Promise<any>) {
		try {
			const invite = await guild.invites.create(channelId, { maxAge: 0, maxUses: 0, unique: true })
			return sendFn({ content: `Here is your new invite link: ${invite.url}` })
		} catch {
			return sendFn({ content: 'Failed to create a server invite.' })
		}
	}

	private async handleGetExistingInvite(guild: Guild, sendFn: (content: any) => Promise<any>) {
		try {
			const invites = await guild.invites.fetch()
			const invite = invites.first()
			return sendFn({ content: `Here is an existing invite link: ${invite.url}` })
		} catch {
			return sendFn({ content: 'There are no existing server invites.' })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('createinvite')
				.setDescription('Creates an invite link for a server')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('new')
						.setDescription('Creates a new invite link for the server')
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('existing')
						.setDescription('Fetches an existing invite link for the server')
				)
		)
	}
}
