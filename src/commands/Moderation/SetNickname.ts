import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { GuildMember, Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'setnickname',
	description: "Sets a user's nickname.",
	usage: 'setnickname <member> [nickname]',
	examples: [
		{ example: 'setnickname @User#0001 NewNickname', description: 'Sets the nickname of @User#0001 to NewNickname.' },
		{ example: 'setnickname @User#0001', description: 'Resets the nickname of @User#0001.' }
	],
	runIn: ['GUILD_ANY'],
	requiredClientPermissions: ['ManageNicknames'],
	requiredUserPermissions: ['ManageNicknames']
})
export class SetNickname extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const member: GuildMember = await args.pick('member')
		if (!member) return message.channel.send({ content: 'No member provided.' })

		const nickname: string = await args
			.rest('string')
			.then((n) => n)
			.catch(() => null)
		if (!nickname) return message.channel.send({ content: 'No nickname provided.' })

		await member.setNickname(nickname)
		return message.channel.send({ content: `Nickname has been set to \`${nickname}\` for ${member}.` })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const member = interaction.options.getMember('member') as GuildMember
		const nickname = interaction.options.getString('nickname', true)

		if (!member) return interaction.reply({ content: 'Member not found.', flags: ['Ephemeral'] })

		if (!nickname) member.setNickname(null)
		else await member.setNickname(nickname)

		return interaction.reply({ content: `Nickname has been set to \`${nickname}\` for ${member}.`, flags: ['Ephemeral'] })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('setnickname')
				.setDescription("Sets a user's nickname.")
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to set the nickname for.')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('nickname')
						.setDescription('The new nickname for the member.')
						.setRequired(false)
				)
		)
	}
}
