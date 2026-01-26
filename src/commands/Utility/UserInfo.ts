import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, type GuildMember, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
	name: 'userinfo',
	aliases: [],
	description: 'Get information about a user',
	usage: 'userinfo [member]',
	examples: [
		{ example: 'userinfo', description: 'Get information about yourself' },
		{ example: 'userinfo @User', description: 'Get information about a user' }
	],
	runIn: ['GUILD_ANY']
})
export class UserInfo extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const member = await args.pickResult('member').then((m) => m.unwrapOrElse(() => message.member))
		return message.channel.send({ embeds: [this.buildUserInfoEmbed(member)] })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const member = interaction.options.getMember('member') as GuildMember
		return interaction.reply({ embeds: [this.buildUserInfoEmbed(member)], flags: ['Ephemeral'] })
	}

	private buildUserInfoEmbed(member: GuildMember) {
		const getJoinPosition = this.client.tasks.get('getjoinposition')

		return new EmbedBuilder()
			.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
			.setThumbnail(member.user.bannerURL() ?? member.user.displayAvatarURL())
			.setColor(Colors.Green)
			.addFields(
				{ name: 'User ID', value: member.id, inline: true },
				{ name: 'Account Created', value: member.user.createdAt.toLocaleString(), inline: true },
				{ name: 'Joined Server', value: member.joinedAt ? member.joinedAt.toLocaleString() : 'Unknown', inline: true },
				{ name: 'Join Position', value: getJoinPosition.exec(member) },
				{
					name: `Roles [${member.roles.cache.size - 1}]`,
					value:
						member.roles.cache.size - 1 > 0
							? member.roles.cache
									.map((r) => r)
									.sort((a, b) => b.position - a.position)
									.map((r) => r.name)
									.join(', ')
							: 'None'
				}
			)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('userinfo')
				.setDescription('Get information about a user')
				.addUserOption((option) =>
					option
						.setName('member')
						.setDescription('The member to get information about')
						.setRequired(true)
				)
		)
	}
}
