import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'
import { parseReminderInput } from '../../lib/util/reminderParser'

@ApplyOptions<Command.Options>({
	name: 'remindme',
	description: 'Set a reminder for yourself',
	detailedDescription: 'Schedules a personal reminder using natural language or a duration offset.\n\nAll times are interpreted as UTC.',
	examples: [
		{ example: 'remindme 2h check the oven', description: 'Reminds you in 2 hours.' },
		{ example: 'remindme in 3 days do the thing', description: 'Reminds you in 3 days.' },
		{ example: 'remindme next thursday at 3pm send the report', description: 'Reminds you next Thursday at 15:00 UTC.' },
		{ example: 'remindme do the dishes tomorrow', description: 'Reminds you tomorrow.' }
	]
})
export class RemindmeCommand extends Command {
	private client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const input = await args.restResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!input) return message.channel.send('❌ Please provide a time and message.\nExample: `remindme 2h check the oven`')

		const parsed = parseReminderInput(input)
		if (!parsed) return message.channel.send("❌ Couldn't parse a time from your input. Try: `2h check something`, `in 3 days meeting`, or `next thursday at 3pm event`.")

		const reminder = await this.client.reminders.create({
			userId: message.author.id,
			guildId: message.guild?.id ?? null,
			channelId: message.channel.id,
			message: parsed.message,
			triggerAt: parsed.triggerAt
		})

		return message.channel.send({ embeds: [this._buildConfirmEmbed(parsed.message, parsed.triggerAt, reminder.reminderId)] })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const input = interaction.options.getString('reminder', true)
		const parsed = parseReminderInput(input)
		if (!parsed) return interaction.reply({ content: "❌ Couldn't parse a time from your input. Try: `2h check something`, `in 3 days meeting`, or `next thursday at 3pm event`.", ephemeral: true })

		const reminder = await this.client.reminders.create({
			userId: interaction.user.id,
			guildId: interaction.guildId ?? null,
			channelId: interaction.channelId,
			message: parsed.message,
			triggerAt: parsed.triggerAt
		})

		return interaction.reply({ embeds: [this._buildConfirmEmbed(parsed.message, parsed.triggerAt, reminder.reminderId)], ephemeral: true })
	}

	private _buildConfirmEmbed(message: string, triggerAt: Date, reminderId: string): EmbedBuilder {
		const unix = Math.floor(triggerAt.getTime() / 1000)
		return new EmbedBuilder()
			.setColor(Colors.HighlightYellow)
			.setTitle('⏰ Reminder Set')
			.setDescription(message)
			.addFields(
				{ name: 'Fires', value: `<t:${unix}:F> (<t:${unix}:R>)`, inline: true },
				{ name: 'ID', value: `\`${reminderId}\``, inline: true }
			)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('remindme')
				.setDescription('Set a reminder for yourself')
				.addStringOption(opt =>
					opt
						.setName('reminder')
						.setDescription('Time and message, e.g. "2h check oven", "in 3 days meeting", "next thursday at 3pm event"')
						.setRequired(true)
				)
		)
	}
}
