import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, TextChannel, ChannelType, Message, Guild } from 'discord.js'
import { Colors } from '../../lib/util/Colors'
import { ThreadConfig } from '../../typings/@definitions/Threads'

@ApplyOptions<Subcommand.Options>({
	name: 'thread',
	description: 'Modmail thread system management',
	detailedDescription:
		'Configure and manage the Modmail thread system for your server.\n(This command requires you to uses slash commands for configuring)',
	usage: 'thread <setup|configure|blacklist|unblacklist|close|anonymous> [options]',
	examples: [
		{ example: 'thread setup', description: 'Automatically set up the Modmail system with default channels and roles.' },
		{ example: 'thread configure', description: 'Update individual settings (category, transcript channel, or staff role).' },
		{ example: 'thread blacklist @user', description: 'Prevent a user from creating Modmail threads.' },
		{ example: 'thread unblacklist @user', description: 'Allow a previously blacklisted user to create threads.' },
		{ example: 'thread close [reason]', description: 'Close the current thread (use in a thread channel).' },
		{ example: 'thread anonymous true', description: 'Enable anonymous mode so staff names are hidden from users.' },
		{ example: 'thread anonymous false', description: 'Disable anonymous mode so staff names are visible to users.' }
	],
	subcommands: [
		{ name: 'setup', messageRun: 'setupMsg', chatInputRun: 'setupInput' },
		{ name: 'configure', messageRun: 'configureMsg', chatInputRun: 'configureInput' },
		{ name: 'status', messageRun: 'statusMsg', chatInputRun: 'statusInput' },
		{ name: 'blacklist', messageRun: 'blacklistMsg', chatInputRun: 'blacklistInput' },
		{ name: 'unblacklist', messageRun: 'unblacklistMsg', chatInputRun: 'unblacklistInput' },
		{ name: 'close', messageRun: 'closeMsg', chatInputRun: 'closeInput' },
		{ name: 'anonymous', messageRun: 'anonymousMsg', chatInputRun: 'anonymousInput' }
	],
	requiredUserPermissions: [PermissionFlagsBits.ManageGuild],
	runIn: ['GUILD_ANY']
})
export class ThreadCommand extends Subcommand {
	client = this.container.client

	public async setupMsg(message: Message) {
		if (!message.channel.isSendable()) return

		const loading = await message.channel.send('⏳ Setting up Modmail system...')

		try {
			const oldConfig = this.client.settings.get(message.guild.id, 'thread', {})
			if (oldConfig.setupMessageId && oldConfig.setupChannelId) {
				try {
					const oldChannel = message.guild.channels.cache.get(oldConfig.setupChannelId) as TextChannel
					if (oldChannel) {
						const oldMessage = await oldChannel.messages.fetch(oldConfig.setupMessageId).catch(() => null)
						if (oldMessage) await oldMessage.delete()
					}
				} catch {}
			}

			const { category, transcript, role, buttonChannel } = await this.autoSetup(message.guild)

			const embed = new EmbedBuilder()
				.setColor(Colors.Active)
				.setTitle('✅ Thread System Configured')
				.setDescription('Modmail system has been automatically configured!')
				.addFields(
					{ name: 'Thread Category', value: `<#${category.id}>`, inline: true },
					{ name: 'Transcript Channel', value: `<#${transcript.id}>`, inline: true },
					{ name: 'Staff Role', value: `<@&${role.id}>`, inline: true },
					{ name: 'Modmail Channel', value: `<#${buttonChannel.id}>`, inline: true }
				)
				.setTimestamp()

			await loading.edit({ content: '', embeds: [embed] })
		} catch (error) {
			await loading.edit(`❌ Failed to setup Modmail system: ${error instanceof Error ? error.message : 'Unknown error'}`)
		}
	}

	public async setupInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const categoryOpt = interaction.options.getChannel('category', false)
		const transcriptOpt = interaction.options.getChannel('transcript', false)
		const staffOpt = interaction.options.getRole('staff', false)
		const buttonChannelOpt = interaction.options.getChannel('button', false)

		await interaction.deferReply({ flags: ['Ephemeral'] })

		try {
			let category, transcript, staff, buttonChannel

			if (!categoryOpt || !transcriptOpt || !staffOpt) {
				const created = await this.autoSetup(interaction.guild!)
				category = categoryOpt || created.category
				transcript = transcriptOpt || created.transcript
				staff = staffOpt || created.role
				buttonChannel = buttonChannelOpt || created.buttonChannel
			} else {
				category = categoryOpt
				transcript = transcriptOpt
				staff = staffOpt
				buttonChannel = buttonChannelOpt
			}

			const config: ThreadConfig = this.client.settings.get(interaction.guildId!, 'thread', {})
			config.categoryId = category.id
			config.transcriptChannel = transcript.id
			config.staffRoles = [staff.id]
			this.client.settings.set(interaction.guildId!, 'thread', config)

			const embed = new EmbedBuilder()
				.setColor(Colors.Active)
				.setTitle('✅ Thread System Configured')
				.setDescription(
					!categoryOpt || !transcriptOpt || !staffOpt
						? 'Modmail system has been automatically configured!'
						: 'Modmail system configured with your selections.'
				)
				.addFields(
					{ name: 'Thread Category', value: `<#${category.id}>`, inline: true },
					{ name: 'Transcript Channel', value: `<#${transcript.id}>`, inline: true },
					{ name: 'Staff Role', value: `<@&${staff.id}>`, inline: true }
				)
				.setTimestamp()

			if (buttonChannel) embed.addFields({ name: 'Modmail Channel', value: `<#${buttonChannel.id}>`, inline: true })

			await interaction.editReply({ embeds: [embed] })

			if (buttonChannel) {
				const channel = buttonChannel as TextChannel
				const config: ThreadConfig = this.client.settings.get(interaction.guildId!, 'thread', {})

				if (config.setupMessageId) {
					try {
						const oldMessage = await channel.messages.fetch(config.setupMessageId).catch(() => null)
						if (oldMessage) await oldMessage.delete()
					} catch {}
				}
				const buttonEmbed = new EmbedBuilder()
					.setColor(Colors.Blurple)
					.setTitle('📬 Modmail')
					.setDescription('Need help? Click the button below to create a Modmail thread.\nA staff member will respond to you via DMs.')
					.setFooter({ text: 'Make sure your DMs are open!' })

				const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId('create_thread').setLabel('Create Thread').setStyle(ButtonStyle.Primary).setEmoji('📨')
				)

				const setupMessage = await channel.send({ embeds: [buttonEmbed], components: [row] })
				config.setupMessageId = setupMessage.id
				config.setupChannelId = channel.id
				this.client.settings.set(interaction.guildId!, 'thread', config)
			}
		} catch (error) {
			await interaction.editReply({ content: `❌ Failed to setup: ${error instanceof Error ? error.message : 'Unknown error'}` })
		}
	}

	private async autoSetup(guild: Guild) {
		const category = await guild.channels.create({
			name: 'Modmail',
			type: ChannelType.GuildCategory,
			permissionOverwrites: [
				{
					id: guild.id,
					deny: [PermissionFlagsBits.ViewChannel]
				}
			]
		})

		const transcript = await guild.channels.create({
			name: 'modmail-transcripts',
			type: ChannelType.GuildText,
			parent: category.id,
			permissionOverwrites: [
				{
					id: guild.id,
					deny: [PermissionFlagsBits.ViewChannel]
				}
			]
		})

		const buttonChannel = await guild.channels.create({
			name: 'modmail',
			type: ChannelType.GuildText,
			topic: 'Click the button below to create a Modmail thread with staff',
			permissionOverwrites: [
				{
					id: guild.id,
					allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
					deny: [PermissionFlagsBits.SendMessages]
				}
			]
		})

		const role = await guild.roles.create({
			name: 'Support',
			color: Colors.Blurple,
			permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory]
		})

		await category.permissionOverwrites.create(role.id, {
			ViewChannel: true,
			SendMessages: true,
			ReadMessageHistory: true
		})

		await transcript.permissionOverwrites.create(role.id, {
			ViewChannel: true,
			SendMessages: false,
			ReadMessageHistory: true
		})

		const buttonEmbed = new EmbedBuilder()
			.setColor(Colors.Blurple)
			.setTitle('📬 Modmail')
			.setDescription('Need help? Click the button below to create a Modmail thread.\nA staff member will respond to you via DMs.')
			.setFooter({ text: 'Make sure your DMs are open!' })

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('create_thread').setLabel('Create Thread').setStyle(ButtonStyle.Primary).setEmoji('📨')
		)

		const setupMessage = await buttonChannel.send({ embeds: [buttonEmbed], components: [row] })

		const config: ThreadConfig = this.client.settings.get(guild.id, 'thread', {})
		config.categoryId = category.id
		config.transcriptChannel = transcript.id
		config.staffRoles = [role.id]
		config.setupMessageId = setupMessage.id
		config.setupChannelId = buttonChannel.id
		this.client.settings.set(guild.id, 'thread', config)

		return { category, transcript, role, buttonChannel }
	}

	public async configureMsg(message: Message) {
		if (!message.channel.isSendable()) return

		await message.channel.send('❌ Please use the slash command `/thread configure` to modify individual settings.')
	}

	public async statusMsg(message: Message) {
		if (!message.channel.isSendable()) return
		if (!message.guild) return

		const config: ThreadConfig = this.client.settings.get(message.guild.id, 'thread', {})
		const categoryId = config.categoryId || null
		const transcriptId = config.transcriptChannel || null
		const setupChannelId = config.setupChannelId || null
		const staffRoles = config.staffRoles || []
		const anonymous = config.anonymous || false
		const blacklist = config.blacklist || []

		const embed = new EmbedBuilder()
			.setColor(categoryId ? Colors.Active : Colors.Critical)
			.setTitle('📋 Modmail System Status')
			.addFields(
				{ name: 'Thread Category', value: categoryId ? `<#${categoryId}>` : '❌ Not configured', inline: true },
				{ name: 'Transcript Channel', value: transcriptId ? `<#${transcriptId}>` : '❌ Not configured', inline: true },
				{ name: 'Setup Channel', value: setupChannelId ? `<#${setupChannelId}>` : '❌ Not configured', inline: true },
				{
					name: 'Staff Roles',
					value: staffRoles.length > 0 ? staffRoles.map((r: string) => `<@&${r}>`).join(', ') : '❌ Not configured',
					inline: false
				},
				{ name: 'Anonymous Mode', value: anonymous ? '✅ Enabled' : '❌ Disabled', inline: true },
				{ name: 'Blacklisted Users', value: blacklist.length > 0 ? `${blacklist.length} user(s)` : 'None', inline: true }
			)
			.setTimestamp()

		await message.channel.send({ embeds: [embed] })
	}

	public async statusInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const config: ThreadConfig = this.client.settings.get(interaction.guildId!, 'thread', {})
		const categoryId = config.categoryId || null
		const transcriptId = config.transcriptChannel || null
		const setupChannelId = config.setupChannelId || null
		const staffRoles = config.staffRoles || []
		const anonymous = config.anonymous || false
		const blacklist = config.blacklist || []

		const embed = new EmbedBuilder()
			.setColor(categoryId ? Colors.Active : Colors.Critical)
			.setTitle('📋 Modmail System Status')
			.addFields(
				{ name: 'Thread Category', value: categoryId ? `<#${categoryId}>` : '❌ Not configured', inline: true },
				{ name: 'Transcript Channel', value: transcriptId ? `<#${transcriptId}>` : '❌ Not configured', inline: true },
				{ name: 'Setup Channel', value: setupChannelId ? `<#${setupChannelId}>` : '❌ Not configured', inline: true },
				{
					name: 'Staff Roles',
					value: staffRoles.length > 0 ? staffRoles.map((r: string) => `<@&${r}>`).join(', ') : '❌ Not configured',
					inline: false
				},
				{ name: 'Anonymous Mode', value: anonymous ? '✅ Enabled' : '❌ Disabled', inline: true },
				{ name: 'Blacklisted Users', value: blacklist.length > 0 ? `${blacklist.length} user(s)` : 'None', inline: true }
			)
			.setTimestamp()

		await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
	}

	public async configureInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const category = interaction.options.getChannel('category', false)
		const transcript = interaction.options.getChannel('transcript', false)
		const staff = interaction.options.getRole('staff', false)

		if (!category && !transcript && !staff) {
			return interaction.reply({
				content: '❌ Please specify at least one setting to configure.',
				flags: ['Ephemeral']
			})
		}

		const updates: string[] = []
		const config: ThreadConfig = this.client.settings.get(interaction.guildId!, 'thread', {})

		if (category) {
			config.categoryId = category.id
			updates.push(`Thread Category: <#${category.id}>`)
		}

		if (transcript) {
			config.transcriptChannel = transcript.id
			updates.push(`Transcript Channel: <#${transcript.id}>`)
		}

		if (staff) {
			config.staffRoles = [staff.id]
			updates.push(`Staff Role: <@&${staff.id}>`)
		}

		this.client.settings.set(interaction.guildId!, 'thread', config)

		const embed = new EmbedBuilder()
			.setColor(Colors.Active)
			.setTitle('✅ Thread System Updated')
			.setDescription('The following settings have been updated:')
			.addFields({ name: 'Changes', value: updates.join('\n') })
			.setTimestamp()

		await interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
	}

	public async blacklistInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true)

		const blacklist = this.client.settings.get(interaction.guildId!, 'thread.blacklist', [])
		if (blacklist.includes(user.id)) {
			return interaction.reply({ content: '❌ User is already blacklisted.', flags: ['Ephemeral'] })
		}

		blacklist.push(user.id)
		this.client.settings.set(interaction.guildId!, 'thread.blacklist', blacklist)

		await interaction.reply({ content: `✅ ${user.tag} has been blacklisted from creating threads.`, flags: ['Ephemeral'] })
	}

	public async blacklistMsg(message: Message) {
		if (!message.channel.isSendable()) return
		await message.channel.send('❌ Please use the slash command `/thread blacklist @user` to blacklist users.')
	}

	public async unblacklistInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const user = interaction.options.getUser('user', true)

		const blacklist = this.client.settings.get(interaction.guildId!, 'thread.blacklist', [])
		const index = blacklist.indexOf(user.id)

		if (index === -1) {
			return interaction.reply({ content: '❌ User is not blacklisted.', flags: ['Ephemeral'] })
		}

		blacklist.splice(index, 1)
		this.client.settings.set(interaction.guildId!, 'thread.blacklist', blacklist)

		await interaction.reply({ content: `✅ ${user.tag} has been removed from the blacklist.`, flags: ['Ephemeral'] })
	}

	public async unblacklistMsg(message: Message) {
		if (!message.channel.isSendable()) return
		await message.channel.send('❌ Please use the slash command `/thread unblacklist @user` to unblacklist users.')
	}

	public async closeInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const reason = interaction.options.getString('reason', false)

		if (!this.client.threads.isThreadChannel(interaction.channelId)) {
			return interaction.reply({ content: '❌ This is not a thread channel.', flags: ['Ephemeral'] })
		}

		const thread = this.client.threads.getThreadByChannelId(interaction.channelId)

		if (!thread) {
			return interaction.reply({ content: '❌ Thread not found.', flags: ['Ephemeral'] })
		}

		await interaction.reply({ content: '🔒 Closing thread...', flags: ['Ephemeral'] })
		await this.client.threads.closeThread(thread.threadId, interaction.user.tag, reason || undefined)
	}

	public async closeMsg(message: Message) {
		if (!message.channel.isSendable()) return
		await message.channel.send('❌ Please use the slash command `/thread close` to close threads.')
	}

	public async anonymousInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const enabled = interaction.options.getBoolean('enabled', true)

		this.client.settings.set(interaction.guildId!, 'thread.anonymous', enabled)

		await interaction.reply({
			content: `✅ Anonymous mode ${enabled ? 'enabled' : 'disabled'}.`,
			flags: ['Ephemeral']
		})
	}

	public async anonymousMsg(message: Message) {
		if (!message.channel.isSendable()) return
		await message.channel.send('❌ Please use the slash command `/thread anonymous true/false` to toggle anonymous mode.')
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('thread')
				.setDescription('Modmail thread system management')
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
				.addSubcommand((sub) =>
					sub
						.setName('setup')
						.setDescription('Setup the thread system (automatically creates channels/roles if not specified)')
						.addChannelOption((option) =>
							option
								.setName('category')
								.setDescription('Category for thread channels (auto-created if not specified)')
								.addChannelTypes(ChannelType.GuildCategory)
								.setRequired(false)
						)
						.addChannelOption((option) =>
							option
								.setName('transcript')
								.setDescription('Channel for transcripts (auto-created if not specified)')
								.addChannelTypes(ChannelType.GuildText)
								.setRequired(false)
						)
						.addRoleOption((option) =>
							option
								.setName('staff')
								.setDescription('Staff role that can view threads (auto-created if not specified)')
								.setRequired(false)
						)
						.addChannelOption((option) =>
							option
								.setName('button')
								.setDescription('Channel to send the create thread button (auto-created if not specified)')
								.addChannelTypes(ChannelType.GuildText)
								.setRequired(false)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('configure')
						.setDescription('Update individual thread system settings')
						.addChannelOption((option) =>
							option
								.setName('category')
								.setDescription('Update the thread category')
								.addChannelTypes(ChannelType.GuildCategory)
								.setRequired(false)
						)
						.addChannelOption((option) =>
							option
								.setName('transcript')
								.setDescription('Update the transcript channel')
								.addChannelTypes(ChannelType.GuildText)
								.setRequired(false)
						)
						.addRoleOption((option) =>
							option
								.setName('staff')
								.setDescription('Update the staff role')
								.setRequired(false)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('status')
						.setDescription('View current Modmail system configuration')
				)
				.addSubcommand((sub) =>
					sub
						.setName('blacklist')
						.setDescription('Blacklist a user from creating threads')
						.addUserOption((option) =>
							option
								.setName('user')
								.setDescription('User to blacklist')
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('unblacklist')
						.setDescription('Remove a user from the blacklist')
						.addUserOption((option) =>
							option
								.setName('user')
								.setDescription('User to unblacklist')
								.setRequired(true)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('close')
						.setDescription('Close the current thread')
						.addStringOption((option) =>
							option
								.setName('reason')
								.setDescription('Reason for closing')
								.setRequired(false)
						)
				)
				.addSubcommand((sub) =>
					sub
						.setName('anonymous')
						.setDescription('Toggle anonymous mode')
						.addBooleanOption((option) =>
							option
								.setName('enabled')
								.setDescription('Enable or disable anonymous mode')
								.setRequired(true)
						)
				)
		)
	}
}
