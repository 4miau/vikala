import { ApplyOptions } from '@sapphire/decorators'
import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'
import Changelog from '../../database/Changelog'

@ApplyOptions<Subcommand.Options>({
	name: 'changelog',
	aliases: ['cl', 'changes'],
	description: 'Manage bot changelog entries',
	usage: 'changelog <add|remove|list|view>',
	examples: [
		{ example: 'changelog add feature "New Command" "Added a new game deals command"', description: 'Add a new feature entry' },
		{ example: 'changelog add bugfix "Fix crash" "Fixed crash when using ping command" v1.2.3', description: 'Add a bugfix entry with version' },
		{ example: 'changelog remove 5', description: 'Remove changelog entry with ID 5' },
		{ example: 'changelog list', description: 'List all changelog entries' },
		{ example: 'changelog view 5', description: 'View specific changelog entry by ID' }
	],
	subcommands: [
		{ name: 'add', messageRun: 'addMsgEntry', chatInputRun: 'addChatEntry' },
		{ name: 'remove', messageRun: 'removeMsgEntry', chatInputRun: 'removeChatEntry' },
		{ name: 'list', messageRun: 'listMsgEntries', chatInputRun: 'listChatEntries', default: true },
		{ name: 'view', messageRun: 'viewMsgEntry', chatInputRun: 'viewChatEntry' }
	]
})
export class ChangelogCommand extends Subcommand {
	client = this.container.client

	public async addMsgEntry(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		if (message.author.id !== this.client.owner) {
			return (message.channel as TextChannel).send({ content: 'This command is restricted to the bot owner.' })
		}

		const category = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const title = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const description = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const version = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleAddEntry(
			category,
			title,
			description,
			version,
			message.author.id,
			message.author.username,
			(content) => (message.channel as TextChannel).send(content)
		)
	}

	public async addChatEntry(interaction: Subcommand.ChatInputCommandInteraction) {
		if (interaction.user.id !== this.client.owner) {
			return interaction.reply({ content: 'This command is restricted to the bot owner.', flags: ['Ephemeral'] })
		}

		const category = interaction.options.getString('category', true)
		const title = interaction.options.getString('title', true)
		const description = interaction.options.getString('description', true)
		const version = interaction.options.getString('version')

		return this.handleAddEntry(
			category,
			title,
			description,
			version,
			interaction.user.id,
			interaction.user.username,
			(content) => interaction.reply(content)
		)
	}

	public async removeMsgEntry(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		if (message.author.id !== this.client.owner) {
			return (message.channel as TextChannel).send({ content: 'This command is restricted to the bot owner.' })
		}

		const id = await args.pickResult('number').then((res) => (res.isOk() ? res.unwrap() : null))
		return this.handleRemoveEntry(id, (content) => (message.channel as TextChannel).send(content))
	}

	public async removeChatEntry(interaction: Subcommand.ChatInputCommandInteraction) {
		if (interaction.user.id !== this.client.owner) {
			return interaction.reply({ content: 'This command is restricted to the bot owner.', flags: ['Ephemeral'] })
		}

		const id = interaction.options.getNumber('id', true)

		return this.handleRemoveEntry(id, (content) => interaction.reply(content))
	}

	public async listMsgEntries(message: Message) {
		if (!message.channel.isSendable()) return

		return this.handleListEntries((content) => (message.channel as TextChannel).send(content))
	}

	public async listChatEntries(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.handleListEntries((content) => interaction.reply(content))
	}

	public async viewMsgEntry(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		if (message.author.id !== this.client.owner) {
			return (message.channel as TextChannel).send({ content: 'This command is restricted to the bot owner.' })
		}

		const id = await args.pickResult('number').then((res) => (res.isOk() ? res.unwrap() : null))

		return this.handleViewEntry(id, (content) => (message.channel as TextChannel).send(content))
	}

	public async viewChatEntry(interaction: Subcommand.ChatInputCommandInteraction) {
		if (interaction.user.id !== this.client.owner) {
			return interaction.reply({ content: 'This command is restricted to the bot owner.', flags: ['Ephemeral'] })
		}

		const id = interaction.options.getNumber('id', true)
		return this.handleViewEntry(id, (content) => interaction.reply(content))
	}

	private async handleAddEntry(
		category: string | null,
		title: string | null,
		description: string | null,
		version: string | null,
		userId: string,
		username: string,
		sendFn: (content: any) => Promise<any>
	) {
		if (!category || !title || !description) {
			return sendFn({ content: 'Please provide category, title, and description for the changelog entry.' })
		}

		const validCategories = ['feature', 'bugfix', 'improvement', 'breaking', 'other']
		if (!validCategories.includes(category.toLowerCase())) {
			return sendFn({ content: `Invalid category. Valid categories: ${validCategories.join(', ')}` })
		}

		try {
			const lastEntry = await Changelog.findOne().sort({ id: -1 })
			const nextId = lastEntry ? lastEntry.id + 1 : 1

			const entry = new Changelog({
				id: nextId,
				version: version || undefined,
				title,
				description,
				category: category.toLowerCase(),
				createdBy: userId,
				createdByUsername: username,
				createdAt: new Date()
			})

			await entry.save()

			const embed = new EmbedBuilder()
				.setColor(Colors.Green)
				.setTitle('Changelog Entry Added')
				.setDescription(`Entry ID: **${nextId}**`)
				.addFields(
					{ name: 'Category', value: this.getCategoryEmoji(entry.category) + ' ' + this.capitalizeFirst(entry.category), inline: true },
					{ name: 'Version', value: entry.version || 'N/A', inline: true },
					{ name: '\u200B', value: '\u200B', inline: true },
					{ name: 'Title', value: entry.title },
					{ name: 'Description', value: entry.description }
				)
				.setFooter({ text: `Added by ${username}` })
				.setTimestamp()

			return sendFn({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error('Failed to add changelog entry:', error)
			return sendFn({ content: 'Failed to add changelog entry. Please try again.' })
		}
	}

	private async handleRemoveEntry(id: number | null, sendFn: (content: any) => Promise<any>) {
		if (!id) return sendFn({ content: 'Please provide the ID of the changelog entry to remove.' })

		try {
			const entry = await Changelog.findOne({ id })

			if (!entry) return sendFn({ content: `Changelog entry with ID **${id}** not found.` })
			await Changelog.deleteOne({ id })

			const embed = new EmbedBuilder()
				.setColor(Colors.Red)
				.setTitle('Changelog Entry Removed')
				.setDescription(`Entry ID: **${id}**`)
				.addFields(
					{ name: 'Category', value: this.getCategoryEmoji(entry.category) + ' ' + this.capitalizeFirst(entry.category), inline: true },
					{ name: 'Version', value: entry.version || 'N/A', inline: true },
					{ name: '\u200B', value: '\u200B', inline: true },
					{ name: 'Title', value: entry.title },
					{ name: 'Description', value: entry.description }
				)
				.setTimestamp()

			return sendFn({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error('Failed to remove changelog entry:', error)
			return sendFn({ content: 'Failed to remove changelog entry. Please try again.' })
		}
	}

	private async handleListEntries(sendFn: (content: any) => Promise<any>) {
		try {
			const entries = await Changelog.find().sort({ id: -1 }).limit(25)

			if (entries.length === 0) return sendFn({ content: 'No changelog entries found.' })

			const embed = new EmbedBuilder()
				.setColor(Colors.Blurple)
				.setTitle('Bot Changelog')
				.setDescription(`Showing **${entries.length}** most recent entries`)
				.setTimestamp()

			for (const entry of entries) {
				const versionText = entry.version ? ` - v${entry.version}` : ''
				const categoryEmoji = this.getCategoryEmoji(entry.category)
				const dateText = entry.createdAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

				embed.addFields({
					name: `${categoryEmoji} [ID: ${entry.id}] ${entry.title}${versionText}`,
					value: `${entry.description}\n*${dateText} • ${entry.createdByUsername}*`
				})
			}

			return sendFn({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error('Failed to list changelog entries:', error)
			return sendFn({ content: 'Failed to list changelog entries. Please try again.' })
		}
	}

	private async handleViewEntry(id: number | null, sendFn: (content: any) => Promise<any>) {
		if (!id) return sendFn({ content: 'Please provide the ID of the changelog entry to view.' })

		try {
			const entry = await Changelog.findOne({ id })

			if (!entry) return sendFn({ content: `Changelog entry with ID **${id}** not found.` })

			const embed = new EmbedBuilder()
				.setColor(Colors.Blurple)
				.setTitle(`Changelog Entry #${entry.id}`)
				.addFields(
					{ name: 'Category', value: this.getCategoryEmoji(entry.category) + ' ' + this.capitalizeFirst(entry.category), inline: true },
					{ name: 'Version', value: entry.version || 'N/A', inline: true },
					{ name: '\u200B', value: '\u200B', inline: true },
					{ name: 'Title', value: entry.title },
					{ name: 'Description', value: entry.description }
				)
				.setFooter({ text: `Added by ${entry.createdByUsername}` })
				.setTimestamp(entry.createdAt)

			return sendFn({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error('Failed to view changelog entry:', error)
			return sendFn({ content: 'Failed to view changelog entry. Please try again.' })
		}
	}

	private getCategoryEmoji(category: string): string {
		const emojis: Record<string, string> = {
			feature: '✨',
			bugfix: '🐛',
			improvement: '⚡',
			breaking: '💥',
			other: '📝'
		}
		return emojis[category] || '📝'
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1)
	}

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('changelog')
				.setDescription('Manage bot changelog entries')
				.addSubcommand((subcommand) =>
					subcommand
						.setName('add')
						.setDescription('Add a new changelog entry')
						.addStringOption((option) =>
							option
								.setName('category')
								.setDescription('Category of the change')
								.setRequired(true)
								.addChoices(
									{ name: '✨ Feature', value: 'feature' },
									{ name: '🐛 Bugfix', value: 'bugfix' },
									{ name: '⚡ Improvement', value: 'improvement' },
									{ name: '💥 Breaking', value: 'breaking' },
									{ name: '📝 Other', value: 'other' }
								)
						)
						.addStringOption((option) =>
                            option
                                .setName('title')
                                .setDescription('Title of the changelog entry')
                                .setRequired(true)
                        )
						.addStringOption((option) =>
							option
                                .setName('description')
                                .setDescription('Description of the changes')
                                .setRequired(true)
						)
						.addStringOption((option) =>
                            option
                                .setName('version')
                                .setDescription('Version number (optional)')
                                .setRequired(false)
                        )
				)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('view')
						.setDescription('View a specific changelog entry')
						.addNumberOption((option) =>
							option
								.setName('id')
								.setDescription('ID of the changelog entry to view')
								.setRequired(true))
				)
		)
	}
}
