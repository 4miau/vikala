import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ChannelType, EmbedBuilder, Message, PermissionFlagsBits, TextChannel } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
	name: 'setupverification',
	aliases: ['verifysetup'],
	description: 'Sets up the verification system for this server',
	detailedDescription:
		'Posts a verification message with a Verify button in the specified channel. Members who click it will receive the configured role(s). Optionally customize the message title, description, and button label for different languages or server styles.',
	examples: [
		{ example: 'setupverification #verify @Member', description: 'Set up verification in #verify, granting the Member role.' },
		{ example: 'setupverification #verify @Member @Verified', description: 'Grant multiple roles on verification.' },
		{ example: '/setupverification custom_title:"Vérification" custom_description:"Cliquez pour vérifier"', description: 'Set up with custom French text.' }
	],
	requiredUserPermissions: [PermissionFlagsBits.ManageGuild],
	runIn: ['GUILD_ANY']
})
export class SetupVerificationCommand extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const channel = await args.pickResult('guildTextChannel').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!channel) return message.channel.send('❌ Please provide a valid text channel.\nUsage: `setupverification #channel @role [@role2]`')

		const role1 = await args.pickResult('role').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!role1) return message.channel.send('❌ Please provide at least one role to assign on verification.')

		const role2 = await args.pickResult('role').then((res) => (res.isOk() ? res.unwrap() : null))

		const roles = [role1.id, role2?.id].filter(Boolean) as string[]

		const loading = await message.channel.send('⏳ Setting up verification...')
		const result = await this.client.verification.setup(message.guild!, channel.id, roles, null)

		if (!result.success) return loading.edit(`❌ ${result.error}`)

		const embed = this._buildSuccessEmbed(channel.id, roles, null, undefined, undefined, undefined)
		return loading.edit({ content: '', embeds: [embed] })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		await interaction.deferReply({ flags: ['Ephemeral'] })

		const channel = interaction.options.getChannel('channel', true) as TextChannel
		const role1 = interaction.options.getRole('role', true)
		const role2 = interaction.options.getRole('role2', false)
		const minimumAge = interaction.options.getInteger('minimum_age', false)
		const customTitle = interaction.options.getString('custom_title', false)
		const customDescription = interaction.options.getString('custom_description', false)
		const customButtonLabel = interaction.options.getString('custom_button_label', false)

		const roles = [role1.id, role2?.id].filter(Boolean) as string[]
		const result = await this.client.verification.setup(
			interaction.guild!,
			channel.id,
			roles,
			minimumAge,
			customTitle ?? undefined,
			customDescription ?? undefined,
			customButtonLabel ?? undefined
		)

		if (!result.success) return interaction.editReply({ content: `❌ ${result.error}` })

		const embed = this._buildSuccessEmbed(channel.id, roles, minimumAge, customTitle ?? undefined, customDescription ?? undefined, customButtonLabel ?? undefined)
		return interaction.editReply({ embeds: [embed] })
	}

	private _buildSuccessEmbed(
		channelId: string,
		roleIds: string[],
		minimumAge: number | null,
		customTitle?: string,
		customDescription?: string,
		customButtonLabel?: string
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setColor(Colors.Active)
			.setTitle('✅ Verification System Configured')
			.addFields(
				{ name: 'Channel', value: `<#${channelId}>`, inline: true },
				{ name: 'Roles Assigned', value: roleIds.map(id => `<@&${id}>`).join(', '), inline: true }
			)
			.setTimestamp()

		if (minimumAge) embed.addFields({ name: 'Minimum Account Age', value: `${minimumAge} day(s)`, inline: true })
		if (customTitle) embed.addFields({ name: 'Custom Title', value: customTitle, inline: false })
		if (customDescription) embed.addFields({ name: 'Custom Description', value: customDescription.length > 100 ? customDescription.substring(0, 97) + '...' : customDescription, inline: false })
		if (customButtonLabel) embed.addFields({ name: 'Custom Button Label', value: customButtonLabel, inline: true })

		return embed
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('setupverification')
				.setDescription('Sets up the verification system for this server')
				.addChannelOption(opt =>
					opt
                        .setName('channel')
                        .setDescription('Channel to post the verification message in')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
				)
				.addRoleOption(opt =>
					opt
                        .setName('role')
                        .setDescription('Role to assign upon verification')
                        .setRequired(true)
				)
				.addRoleOption(opt =>
					opt
                        .setName('role2')
                        .setDescription('Additional role to assign upon verification')
                        .setRequired(false)
				)
				.addIntegerOption(opt =>
					opt
                        .setName('minimum_age')
                        .setDescription('Minimum account age in days required to verify')
                        .setRequired(false)
                        .setMinValue(1)
				)
				.addStringOption(opt =>
					opt
                        .setName('custom_title')
                        .setDescription('Custom title for the verification message (default: "Server Verification")')
                        .setRequired(false)
                        .setMaxLength(256)
				)
				.addStringOption(opt =>
					opt
                        .setName('custom_description')
                        .setDescription('Custom description for the verification message')
                        .setRequired(false)
                        .setMaxLength(2048)
				)
				.addStringOption(opt =>
					opt
                        .setName('custom_button_label')
                        .setDescription('Custom label for the verify button (default: "Verify")')
                        .setRequired(false)
                        .setMaxLength(80)
				)
		)
	}
}