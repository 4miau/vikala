import { Command, Args } from '@sapphire/framework'
import type { GuildMember, Message } from 'discord.js'
import Case from '../../database/Case'
import ModLogger from '../../structures/ModLogger'
import { ApplyOptions } from '@sapphire/decorators'

@ApplyOptions<Command.Options>({
	name: 'kick',
	aliases: ['ekick'],
	description: 'Kicks a user from the server.',
	detailedDescription: 'Kicks a user from the server. A reason can be provided.',
	usage: 'kick <member> [reason]',
	examples: [
		{ example: 'kick @User#0001 Spamming', description: 'Kicks the user @User#0001 for spamming.' },
		{ example: 'kick @User#0001', description: 'Kicks the user @User#0001 with no specified reason.' }
	],
	requiredUserPermissions: ['KickMembers'],
	requiredClientPermissions: ['KickMembers'],
	runIn: ['GUILD_TEXT']
})
export class Kick extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		const member = await args.pick('member')
		const reason = (await args.rest('string')) || 'No reason specified'

		if (!message.channel.isSendable()) return
		if (!member.kickable) return message.channel.send('I am unable to kick this user.')

		await member.kick(reason)

		await this.client.cases.createCase(message.guild, {
			message: message.id,
			action: this.client.cases.MOD_ACTIONS[4],
			reason: reason,
			target: member,
			mod: message.member
		})

		return message.channel.send(`Successfully kicked **${member.user.id}**`)
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const member = interaction.options.getMember('member') as GuildMember
		const reason = interaction.options.getString('reason')

		if (!member) return interaction.editReply('Member not found.')
		if (!member.kickable) return interaction.editReply('I am unable to kick this user.')

		await member.kick(reason)

		await this.client.cases.createCase(interaction.guild, {
			message: interaction.id,
			action: this.client.cases.MOD_ACTIONS[4],
			reason: reason,
			target: member,
			mod: interaction.member as GuildMember
		})

		return interaction.editReply(`Successfully kicked **${member.user.id}**`)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('kick')
				.setDescription('Kicks a user from the server.')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('Member to kick')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('Reason for the kick')
						.setRequired(false)
				)
		)
	}
}
