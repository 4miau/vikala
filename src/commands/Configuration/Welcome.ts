import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message, TextChannel } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
	name: 'welcome',
	aliases: ['welcomer'],
	description: 'Configure personalized welcome messages and DM greetings for new members',
	detailedDescription:
		'Comprehensive welcome system with customizable messages using dynamic placeholders, channel-specific announcements, and optional direct message greetings. Create a welcoming first impression with personalized content that scales automatically.',
	examples: [
		{ example: 'welcome config', description: 'Display current welcome system configuration and status.' },
		{ example: 'welcome set Welcome {user} to {guild}!', description: 'Set basic welcome message with user and server name placeholders.' },
		{ example: 'welcome set 🎉 Welcome {user}! You are member #{memberCount}', description: 'Advanced message with member count and emojis.' },
		{
			example: 'welcome set Hey {username}, welcome to **{guild}**! Check out <#rules> first.',
			description: 'Message with channel mentions and formatting.'
		},
		{ example: 'welcome channel #general', description: 'Set the channel where welcome messages appear.' },
		{ example: 'welcome channel #arrivals', description: 'Use a dedicated arrivals/welcome channel.' },
		{ example: 'welcome dm enable', description: 'Enable private welcome messages sent directly to new members.' },
		{ example: 'welcome dm disable', description: 'Disable DM welcome messages (keep channel messages only).' },
		{ example: 'welcome dm set Welcome to our server! Please read the rules.', description: 'Set personalized DM welcome message content.' },
		{ example: 'welcome enable', description: 'Enable the entire welcome system.' },
		{ example: 'welcome disable', description: 'Temporarily disable welcome system without losing settings.' }
	],
	subcommands: [
		{ name: 'config', chatInputRun: 'chatInputConfig', messageRun: 'messageConfig', default: true },
		{ name: 'set', chatInputRun: 'chatInputSet', messageRun: 'messageSet' },
		{ name: 'channel', chatInputRun: 'chatInputChannel', messageRun: 'messageChannel' },
		{ name: 'dm', chatInputRun: 'chatInputDM', messageRun: 'messageDM' },
		{ name: 'disable', chatInputRun: 'chatInputDisable', messageRun: 'messageDisable' },
		{ name: 'enable', chatInputRun: 'chatInputEnable', messageRun: 'messageEnable' }
	]
})
export class WelcomeCommand extends Subcommand {
	public async messageConfig(message: Message) {
		if (!message.guild || !message.channel.isSendable()) return

		const { client } = this.container
		const config = await client.welcome.getWelcomeConfig(message.guild.id)

		const embed = new EmbedBuilder()
			.setTitle('🎉 Welcome Configuration')
			.setColor(Colors.Green)
			.addFields([
				{ name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
				{ name: 'Channel', value: config.channel ? `<#${config.channel}>` : 'Not set', inline: true },
				{ name: 'DM Welcome', value: config.dmEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
				{ name: 'Public Message', value: config.message || 'Not set', inline: false },
				{ name: 'DM Message', value: config.dmMessage || 'Not set', inline: false }
			])
			.setFooter({ text: 'Variables: {user} {username} {guild} {memberCount}' })

		return message.channel.send({ embeds: [embed] })
	}

	public async chatInputConfig(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return

		const { client } = this.container
		const config = await client.welcome.getWelcomeConfig(interaction.guild.id)

		const embed = new EmbedBuilder()
			.setTitle('🎉 Welcome Configuration')
			.setColor(Colors.Green)
			.addFields([
				{ name: 'Status', value: config.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
				{ name: 'Channel', value: config.channel ? `<#${config.channel}>` : 'Not set', inline: true },
				{ name: 'DM Welcome', value: config.dmEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
				{ name: 'Public Message', value: config.message || 'Not set', inline: false },
				{ name: 'DM Message', value: config.dmMessage || 'Not set', inline: false }
			])
			.setFooter({ text: 'Variables: {user} {username} {guild} {memberCount}' })

		return interaction.reply({ embeds: [embed], ephemeral: true })
	}

	public async messageSet(message: Message, args: Args) {
		if (!message.guild || !message.channel.isSendable()) return
		if (!message.member?.permissions.has('ManageGuild')) {
			return message.channel.send('❌ You need the Manage Server permission to use this command.')
		}

		const welcomeMessage = await args.restResult('string')

		if (!welcomeMessage.ok || !welcomeMessage.unwrap().trim()) {
			return message.channel.send('❌ Please provide a welcome message.\nExample: `welcome set Welcome {user} to {guild}!`')
		}

		const { client } = this.container
		const messageText = welcomeMessage.unwrap()
		await client.welcome.setWelcomeMessage(message.guild.id, messageText)
		await client.welcome.setWelcomeEnabled(message.guild.id, true)

		return message.channel.send(`✅ Welcome message set to: ${messageText}`)
	}

	public async chatInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return
		if (!interaction.memberPermissions?.has('ManageGuild')) {
			return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', ephemeral: true })
		}

		const welcomeMessage = interaction.options.getString('message', true)

		const { client } = this.container
		await client.welcome.setWelcomeMessage(interaction.guild.id, welcomeMessage)
		await client.welcome.setWelcomeEnabled(interaction.guild.id, true)

		return interaction.reply({ content: `✅ Welcome message set to: ${welcomeMessage}`, ephemeral: true })
	}

	public async messageChannel(message: Message, args: Args) {
		if (!message.guild || !message.channel.isSendable()) return
		if (!message.member?.permissions.has('ManageGuild')) {
			return message.channel.send('❌ You need the Manage Server permission to use this command.')
		}

		const channel = await args.pickResult('guildTextChannel')

		if (!channel.ok) {
			return message.channel.send('❌ Please mention a valid text channel.\nExample: `welcome channel #general`')
		}

		const { client } = this.container
		const selectedChannel = channel.unwrap()
		await client.welcome.setWelcomeChannel(message.guild.id, selectedChannel.id)

		return message.channel.send(`✅ Welcome channel set to ${selectedChannel}`)
	}

	public async chatInputChannel(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return
		if (!interaction.memberPermissions?.has('ManageGuild')) {
			return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', ephemeral: true })
		}

		const channel = interaction.options.getChannel('channel', true) as TextChannel

		const { client } = this.container
		await client.welcome.setWelcomeChannel(interaction.guild.id, channel.id)

		return interaction.reply({ content: `✅ Welcome channel set to ${channel}`, ephemeral: true })
	}

	public async messageDM(message: Message, args: Args) {
		if (!message.guild || !message.channel.isSendable()) return
		if (!message.member?.permissions.has('ManageGuild')) {
			return message.channel.send('❌ You need the Manage Server permission to use this command.')
		}

		const action = await args.pickResult('string')

		if (!action.ok) {
			return message.channel.send(
				'❌ Please specify `enable`, `disable`, or `set <message>`.\nExamples:\n`welcome dm enable`\n`welcome dm set Welcome to {guild}!`'
			)
		}

		const { client } = this.container
		const actionValue = action.unwrap()

		switch (actionValue.toLowerCase()) {
			case 'enable':
				await client.welcome.setWelcomeDM(message.guild.id, true)
				return message.channel.send('✅ DM welcome messages enabled')

			case 'disable':
				await client.welcome.setWelcomeDM(message.guild.id, false)
				return message.channel.send('✅ DM welcome messages disabled')

			case 'set':
				const dmMessage = await args.restResult('string')

				if (!dmMessage.ok || !dmMessage.unwrap().trim()) {
					return message.channel.send('❌ Please provide a DM message.\nExample: `welcome dm set Welcome to {guild}! Check our rules.`')
				}

				const dmText = dmMessage.unwrap()
				await client.welcome.setWelcomeDM(message.guild.id, true, dmText)
				return message.channel.send(`✅ DM welcome message set to: ${dmText}`)

			default:
				return message.channel.send('❌ Invalid action. Use `enable`, `disable`, or `set <message>`')
		}
	}

	public async chatInputDM(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return
		if (!interaction.memberPermissions?.has('ManageGuild')) {
			return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', ephemeral: true })
		}

		const enabled = interaction.options.getBoolean('enabled', true)
		const dmMessage = interaction.options.getString('message')

		const { client } = this.container
		await client.welcome.setWelcomeDM(interaction.guild.id, enabled, dmMessage || undefined)

		const response = enabled ? 'enabled' : 'disabled'
		const extra = dmMessage ? ` with message: ${dmMessage}` : ''

		return interaction.reply({ content: `✅ DM welcome messages ${response}${extra}`, ephemeral: true })
	}

	public async messageDisable(message: Message) {
		if (!message.guild || !message.channel.isSendable()) return
		if (!message.member?.permissions.has('ManageGuild')) {
			return message.channel.send('❌ You need the Manage Server permission to use this command.')
		}

		const { client } = this.container
		await client.welcome.setWelcomeEnabled(message.guild.id, false)

		return message.channel.send('✅ Welcome system disabled')
	}

	public async chatInputDisable(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return
		if (!interaction.memberPermissions?.has('ManageGuild')) {
			return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', ephemeral: true })
		}

		const { client } = this.container
		await client.welcome.setWelcomeEnabled(interaction.guild.id, false)

		return interaction.reply({ content: '✅ Welcome system disabled', ephemeral: true })
	}

	public async messageEnable(message: Message) {
		if (!message.guild || !message.channel.isSendable()) return
		if (!message.member?.permissions.has('ManageGuild')) {
			return message.channel.send('❌ You need the Manage Server permission to use this command.')
		}

		const { client } = this.container
		await client.welcome.setWelcomeEnabled(message.guild.id, true)

		return message.channel.send('✅ Welcome system enabled')
	}

	public async chatInputEnable(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guild) return
		if (!interaction.memberPermissions?.has('ManageGuild')) {
			return interaction.reply({ content: '❌ You need the Manage Server permission to use this command.', ephemeral: true })
		}

		const { client } = this.container
		await client.welcome.setWelcomeEnabled(interaction.guild.id, true)

		return interaction.reply({ content: '✅ Welcome system enabled', ephemeral: true })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('welcome')
				.setDescription('Configure welcome messages and settings')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('config')
						.setDescription('View current welcome configuration')
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('set')
						.setDescription('Set welcome message (Manage Server required)')
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('Welcome message with variables: {user} {username} {guild} {memberCount}')
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('channel')
						.setDescription('Set welcome channel (Manage Server required)')
						.addChannelOption((option) =>
							option
								.setName('channel')
								.setDescription('Channel to send welcome messages')
								.setRequired(true)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('dm')
						.setDescription('Configure DM welcome messages (Manage Server required)')
						.addBooleanOption((option) =>
							option
								.setName('enabled')
								.setDescription('Enable or disable DM welcome messages')
								.setRequired(true)
						)
						.addStringOption((option) =>
							option
								.setName('message')
								.setDescription('DM message (optional if just enabling/disabling)')
								.setRequired(false)
						)
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('enable')
						.setDescription('Enable welcome system (Manage Server required)')
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('disable')
						.setDescription('Disable welcome system (Manage Server required)')
				)
		)
	}
}
