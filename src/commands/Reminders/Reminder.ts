import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message } from 'discord.js'
import ms from 'ms'
import { Colors } from '../../lib/util/Colors'
import type { IReminder } from '../../database/Reminder'

@ApplyOptions<Subcommand.Options>({
	name: 'reminder',
	aliases: ['reminders'],
	description: 'Manage your reminders',
	detailedDescription: 'View, cancel, repeat, and subscribe to reminders. Use `remindme` to create one.',
	examples: [
		{ example: 'reminder list', description: 'Show all your active reminders. Also works as: ls, mine.' },
		{ example: 'reminder cancel a1b2c3', description: 'Cancel reminder with ID a1b2c3.' },
		{ example: 'reminder clear', description: 'Cancel all your reminders.' },
		{ example: 'reminder repeat a1b2c3 1d', description: 'Make reminder a1b2c3 repeat daily.' },
		{ example: 'reminder repeat a1b2c3', description: 'Remove the repeat from reminder a1b2c3.' },
		{ example: 'reminder when a1b2c3', description: 'Show when reminder a1b2c3 fires (works for any ID).' },
		{ example: 'reminder subscribe a1b2c3', description: 'Clone reminder a1b2c3 for yourself.' }
	],
	subcommands: [
		{ name: 'list', messageRun: 'listMsg', chatInputRun: 'listInput' },
		{ name: 'ls', messageRun: 'listMsg' },
		{ name: 'mine', messageRun: 'listMsg' },
		{ name: 'cancel', messageRun: 'cancelMsg', chatInputRun: 'cancelInput' },
		{ name: 'clear', messageRun: 'clearMsg', chatInputRun: 'clearInput' },
		{ name: 'repeat', messageRun: 'repeatMsg', chatInputRun: 'repeatInput' },
		{ name: 'when', messageRun: 'whenMsg', chatInputRun: 'whenInput' },
		{ name: 'subscribe', messageRun: 'subscribeMsg', chatInputRun: 'subscribeInput' }
	]
})
export class ReminderCommand extends Subcommand {
	client = this.container.client

	// LIST
	public async listMsg(message: Message) {
		if (!message.channel.isSendable()) return
		return message.channel.send({ embeds: [await this._buildListEmbed(message.author.id)] })
	}

	public async listInput(interaction: Subcommand.ChatInputCommandInteraction) {
		return interaction.reply({ embeds: [await this._buildListEmbed(interaction.user.id)], ephemeral: true })
	}

	// CANCEL
	public async cancelMsg(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		const id = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!id) return message.channel.send('❌ Please provide a reminder ID.\nUsage: `reminder cancel <id>`')

		const deleted = await this.client.reminders.cancel(id, message.author.id)
		return message.channel.send(deleted ? `✅ Reminder \`${id}\` cancelled.` : "❌ Reminder not found or it doesn't belong to you.")
	}

	public async cancelInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const id = interaction.options.getString('id', true)
		const deleted = await this.client.reminders.cancel(id, interaction.user.id)
		return interaction.reply({ content: deleted ? `✅ Reminder \`${id}\` cancelled.` : "❌ Reminder not found or it doesn't belong to you.", ephemeral: true })
	}

	// CLEAR
	public async clearMsg(message: Message) {
		if (!message.channel.isSendable()) return
		const count = await this.client.reminders.clear(message.author.id)
		return message.channel.send(count > 0 ? `✅ Cleared ${count} reminder(s).` : '❌ You have no active reminders to clear.')
	}

	public async clearInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const count = await this.client.reminders.clear(interaction.user.id)
		return interaction.reply({ content: count > 0 ? `✅ Cleared ${count} reminder(s).` : '❌ You have no active reminders to clear.', ephemeral: true })
	}

	// REPEAT
	public async repeatMsg(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		const id = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!id) return message.channel.send('❌ Please provide a reminder ID.\nUsage: `reminder repeat <id> [duration]`')

		const durationStr = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const result = await this._applyRepeat(id, durationStr, message.author.id)
		return message.channel.send(result)
	}

	public async repeatInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const id = interaction.options.getString('id', true)
		const durationStr = interaction.options.getString('interval', false)
		const result = await this._applyRepeat(id, durationStr, interaction.user.id)
		return interaction.reply({ content: result, ephemeral: true })
	}

	// WHEN
	public async whenMsg(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		const id = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!id) return message.channel.send('❌ Please provide a reminder ID.\nUsage: `reminder when <id>`')

		const reminder = await this.client.reminders.get(id)
		if (!reminder) return message.channel.send('❌ No reminder found with that ID.')

		return message.channel.send({ embeds: [this._buildWhenEmbed(reminder)] })
	}

	public async whenInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const id = interaction.options.getString('id', true)
		const reminder = await this.client.reminders.get(id)
		if (!reminder) return interaction.reply({ content: '❌ No reminder found with that ID.', ephemeral: true })

		return interaction.reply({ embeds: [this._buildWhenEmbed(reminder)], ephemeral: true })
	}

	// SUBSCRIBE
	public async subscribeMsg(message: Message, args: Args) {
		if (!message.channel.isSendable()) return
		const id = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!id) return message.channel.send('❌ Please provide a reminder ID.\nUsage: `reminder subscribe <id>`')

		const clone = await this.client.reminders.subscribe(id, message.author.id, message.guild?.id ?? null, message.channel.id)
		if (!clone) return message.channel.send('❌ No reminder found with that ID.')

		const unix = Math.floor(clone.triggerAt.getTime() / 1000)
		return message.channel.send(`✅ Subscribed! Your copy ID is \`${clone.reminderId}\`, fires <t:${unix}:R>.`)
	}

	public async subscribeInput(interaction: Subcommand.ChatInputCommandInteraction) {
		const id = interaction.options.getString('id', true)
		const clone = await this.client.reminders.subscribe(id, interaction.user.id, interaction.guildId, interaction.channelId)
		if (!clone) return interaction.reply({ content: '❌ No reminder found with that ID.', ephemeral: true })

		const unix = Math.floor(clone.triggerAt.getTime() / 1000)
		return interaction.reply({ content: `✅ Subscribed! Your copy ID is \`${clone.reminderId}\`, fires <t:${unix}:R>.`, ephemeral: true })
	}

	// HELPERS
	private async _buildListEmbed(userId: string): Promise<EmbedBuilder> {
		const reminders = await this.client.reminders.list(userId)
		const embed = new EmbedBuilder().setColor(Colors.HighlightYellow).setTitle('⏰ Your Reminders')

		if (!reminders.length) return embed.setDescription('You have no active reminders.')

		const lines = reminders.slice(0, 10).map((r) => {
			const unix = Math.floor(r.triggerAt.getTime() / 1000)
			const text = r.message.length > 60 ? r.message.slice(0, 57) + '...' : r.message
			const repeat = r.repeat ? ` · 🔁 ${r.repeat}` : ''
			return `\`${r.reminderId}\` → ${text}\n⏰ <t:${unix}:F> (<t:${unix}:R>)${repeat}`
		})

		embed.setDescription(lines.join('\n\n'))
		if (reminders.length > 10) embed.setFooter({ text: `Showing 10 of ${reminders.length} reminders` })

		return embed
	}

	private _buildWhenEmbed(reminder: IReminder): EmbedBuilder {
		const unix = Math.floor(reminder.triggerAt.getTime() / 1000)
		const embed = new EmbedBuilder()
			.setColor(Colors.HighlightYellow)
			.setTitle(`⏰ Reminder \`${reminder.reminderId}\``)
			.setDescription(reminder.message)
			.addFields({ name: 'Fires', value: `<t:${unix}:F> (<t:${unix}:R>)`, inline: true })

		if (reminder.repeat) embed.addFields({ name: 'Repeats every', value: reminder.repeat, inline: true })
		if (reminder.subscribedFrom) embed.addFields({ name: 'Subscribed from', value: `\`${reminder.subscribedFrom}\``, inline: true })

		return embed
	}

	private async _applyRepeat(id: string, durationStr: string | null, userId: string): Promise<string> {
		if (durationStr !== null) {
			const duration = Number(ms(durationStr as any))
			if (!duration || duration <= 0) return '❌ Invalid duration. Use formats like `1d`, `12h`, `30m`.'
		}

		const updated = await this.client.reminders.setRepeat(id, userId, durationStr)
		if (!updated) return "❌ Reminder not found or it doesn't belong to you."

		return durationStr ? `✅ Reminder \`${id}\` will now repeat every **${durationStr}**.` : `✅ Repeat removed from reminder \`${id}\`.`
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('reminder')
				.setDescription('Manage your reminders')
				.addSubcommand(sub =>
					sub
						.setName('list')
						.setDescription('Show all your active reminders')
				)
				.addSubcommand(sub =>
					sub
						.setName('cancel')
						.setDescription('Cancel a reminder by ID')
						.addStringOption(opt =>
							opt
								.setName('id')
								.setDescription('Reminder ID')
								.setRequired(true)
						)
				)
				.addSubcommand(sub =>
					sub
						.setName('clear')
						.setDescription('Cancel all your active reminders')
				)
				.addSubcommand(sub =>
					sub
						.setName('repeat')
						.setDescription('Set or remove a repeat interval on a reminder')
						.addStringOption(opt =>
							opt
								.setName('id')
								.setDescription('Reminder ID')
								.setRequired(true)
						)
						.addStringOption(opt =>
							opt
								.setName('interval')
								.setDescription('Repeat interval e.g. 1d, 12h (omit to remove)')
								.setRequired(false)
						)
				)
				.addSubcommand(sub =>
					sub
						.setName('when')
						.setDescription('Show when a reminder fires')
						.addStringOption(opt =>
							opt
								.setName('id')
								.setDescription('Reminder ID')
								.setRequired(true)
						)
				)
				.addSubcommand(sub =>
					sub
						.setName('subscribe')
						.setDescription('Clone another reminder for yourself')
						.addStringOption(opt =>
							opt
								.setName('id')
								.setDescription('Reminder ID to subscribe to')
								.setRequired(true)
						)
				)
		)
	}
}
