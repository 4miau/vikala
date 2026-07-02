import { ApplyOptions } from '@sapphire/decorators'
import { Args, Command } from '@sapphire/framework'
import type { GuildMember, Message } from 'discord.js'

import Case from '../../database/Case'
import ModLogger from '../../structures/ModLogger'

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
	private client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		try {
			const member = await args.pick('member')
			const reason = (await args.rest('string')) || 'No reason specified'

			return this.handleKick(member, reason, message.guild, message.member as GuildMember, (content) =>
				message.channel.send(content)
			)
		} catch {
			return message.channel.send('Failed to kick member. Please check your arguments and try again.')
		}
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		try {
			const member = interaction.options.getMember('member') as GuildMember
			const reason = interaction.options.getString('reason') || 'No reason specified'

			if (!member) return interaction.editReply('Member not found.')

			return this.handleKick(member, reason, interaction.guild, interaction.member as GuildMember, (content) =>
				interaction.editReply(content)
			)
		} catch {
			return interaction.editReply('Failed to kick member. Please try again.')
		}
	}

	private async handleKick(
		member: GuildMember,
		reason: string,
		guild: any,
		mod: GuildMember,
		sendFn: (content: any) => Promise<any>
	) {
		if (!member.kickable) return sendFn('I am unable to kick this user.')

		await member.kick(reason)

		await this.client.cases.createCase(guild, {
			message: member.id,
			action: this.client.cases.MOD_ACTIONS[4],
			reason: reason,
			target: member,
			mod: mod
		})

		return sendFn(`Successfully kicked **${member.user.id}**`)
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
