import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'avatar',
	aliases: ['pfp', 'ava'],
	description: 'Gets the avatar of a member.',
	detailedDescription:
		'Gets the avatar of a member. If no member is provided, it will get the avatar of the message author. ' +
		'You can also specify the size of the avatar using the --size option.',
	usage: 'avatar [member] [--size=size]'
})
export class Avatar extends Command {
	discordPfpBaseUri: string = 'https://avatar-cyan.vercel.app/api/pfp'

	private sizeController(size: number) {
		switch (size) {
			case 128:
				return 'smallimage'
			case 256:
				return '256'
			case 1024:
				return 'bigimage'
			case 2048:
				return '2048'
			case 4096:
				return 'superbigimage'
			default:
				return 'image'
		}
	}

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const member = (await args.pickResult('member')).unwrapOrElse(() => message.member)
		const size = args.getOptionResult('size').unwrapOrElse(() => '256')

		return message.channel.send({ content: [this.discordPfpBaseUri, member.id, this.sizeController(Number(size))].join('/') })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const member = interaction.options.getMember('member') || interaction.member
		const size = interaction.options.getNumber('size') || 256

		return await interaction.reply({ content: [this.discordPfpBaseUri, member, this.sizeController(size)].join('/'), flags: ['Ephemeral'] })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('avatar')
				.setDescription('Gets the avatar of a member (Accepts sizes: 128, 256, 512, 1024, 2048, 4096)')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to get the avatar of')
						.setRequired(false)
				)
				.addNumberOption((option) =>
					option
						.setName('size')
						.setDescription('The size of the avatar')
						.setRequired(false)
						.addChoices([
						{ name: '128', value: 128 },
						{ name: '256', value: 256 },
						{ name: '512', value: 512 },
						{ name: '1024', value: 1024 },
						{ name: '2048', value: 2048 },
						{ name: '4096', value: 4096 }
					])
				)
		)
	}
}
