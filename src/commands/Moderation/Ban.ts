import { Args, Command } from '@sapphire/framework'
import type { GuildMember, Message } from 'discord.js'

import { ApplyOptions } from '@sapphire/decorators'
import { getInput, yes } from '../../lib/util/utilities'

@ApplyOptions<Command.Options>({
	name: 'ban',
	aliases: ['bean'],
	description: 'Bans a user from the server. (Use help for more info)',
	detailedDescription:
		'Bans a user from the server.\nAvailable flags:\n- `--skip` or `--s` for short will prevent the bot from asking for confirmation.',
	usage: 'ban <member...> [--reason=|--r=] [--s]',
	examples: [
		{ example: 'ban @User#0001 --reason=Spamming', description: 'Bans the user @User#0001 for spamming.' },
		{ example: 'ban @User#0001 --s', description: 'Bans the user @User#0001 without asking for confirmation.' },
		{ example: 'ban @User#0001', description: 'Bans the user @User#0001 with no specified reason.' },
		{
			example: 'ban 1234567890 --reason=Spamming --skip',
			description: 'Bans the user with ID 1234567890 for spamming and without asking for confirmation.'
		},
		{
			example: 'ban @Apple @Banana @Cherry "--reason=Fruits are not allowed"',
			description: 'Bans multiple users (@Apple, @Banana, and @Cherry) with a single command for the reason "Fruits are not allowed".'
		}
	],
	options: ['reason', 'r'],
	flags: ['s', 'skip'],
	requiredUserPermissions: ['BanMembers'],
	requiredClientPermissions: ['BanMembers'],
	runIn: ['GUILD_TEXT']
})
export class Ban extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		const members = await args.repeat('member')
		const reason = args.getOption('reason', 'r') || 'No reason specified'
		const skip = args.getFlags('s', 'skip')

		if (!message.channel.isSendable()) return
		if (!members.every((m) => m.bannable)) return message.channel.send('I am unable to ban a provided user.')

		if (!skip) {
			const confirmation = await message.channel.send(
				`${message.author}, are you sure that you would like me to ban\`${members.map((m) => ` ${m}`)}\`? Reply with \`yes\` to confirm.`
			)

			const response = (await getInput(message.channel, { userId: message.author.id }))[0]
			if (!yes(response)) return confirmation.edit('Moderator has not confirmed the ban, the command has now been cancelled.')

			confirmation?.deletable ? confirmation?.delete() : null
		}

		members.forEach(async (m) => {
			await m.ban({ reason: reason })
			await this.client.cases.createCase(message.guild, {
				message: message.id,
				action: this.client.cases.MOD_ACTIONS[1],
				reason: reason,
				target: m,
				mod: message.member
			})
		})

		return message.channel.send(`Successfully banned ${members.length} users. **(${members.map((m) => `${m.user.id} `)})**`)
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const member = interaction.options.getMember('member') as GuildMember
		const reason = interaction.options.getString('reason') || 'No reason specified'

		if (!member) return interaction.editReply('Member not found.')
		if (!member.bannable) return interaction.editReply('I am unable to ban this user.')

		await member.ban({ reason: reason })

		await this.client.cases.createCase(interaction.guild, {
			message: interaction.id,
			action: this.client.cases.MOD_ACTIONS[1],
			reason: reason,
			target: member,
			mod: interaction.member as GuildMember
		})

		return interaction.editReply(`Successfully banned **${member.user.id}**`)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('ban')
				.setDescription('Bans a user from the server.')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to ban.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('reason')
						.setDescription('The reason for the ban.')
						.setRequired(false)
				)
		)
	}
}
