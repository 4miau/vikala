import { ApplyOptions } from '@sapphire/decorators'
import { Args, Command } from '@sapphire/framework'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
	name: 'hotwatch',
	aliases: ['hw', 'watcher'],
	description: 'Manage the hot reload file watcher system.',
	detailedDescription: 'Control the hot reload file watcher that automatically reloads changed files during development.',
	usage: 'hotwatch <action>',
	examples: [
		{ example: 'hotwatch status', description: 'Check if the watcher is running' },
		{ example: 'hotwatch start', description: 'Start the file watcher' },
		{ example: 'hotwatch stop', description: 'Stop the file watcher' },
		{ example: 'hotwatch restart', description: 'Restart the file watcher' }
	],
	preconditions: ['OwnerOnly']
})
export class HotWatch extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const action = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		return this.handleHotWatch(action, (content) => (message.channel as TextChannel).send(content))
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const action = interaction.options.getString('action', true)

		return this.handleHotWatch(action, (content) => interaction.reply(content))
	}

	private async handleHotWatch(action: string, sendFn: (content: any) => Promise<any>) {
		const embed = new EmbedBuilder().setColor(Colors.Blurple)

		try {
			switch (action.toLowerCase()) {
				case 'status': {
					const isRunning = this.client.hotReloadWatcher.isRunning()
					const blacklist = this.client.hotReloadManager.getBlacklist()

					embed
						.setTitle('🔍 Hot Reload Watcher Status')
						.addFields(
							{
								name: 'Status',
								value: isRunning ? '✅ Running' : '❌ Stopped',
								inline: true
							},
							{
								name: 'Environment',
								value: process.env.NODE_ENV || 'development',
								inline: true
							},
							{
								name: 'Blacklisted Structures',
								value: blacklist.length > 0 ? `\`${blacklist.join('`, `')}\`` : 'None',
								inline: false
							}
						)
						.setColor(isRunning ? Colors.Active : Colors.SlateGray)
					break
				}

				case 'start': {
					if (this.client.hotReloadWatcher.isRunning()) {
						embed.setTitle('⚠️ Already Running').setDescription('Hot reload watcher is already active.').setColor(Colors.HighlightYellow)
					} else {
						this.client.hotReloadWatcher.start()
						embed
							.setTitle('✅ Watcher Started')
							.setDescription('Hot reload file watcher has been started. Files will now be automatically reloaded when changed.')
							.setColor(Colors.Active)
					}
					break
				}

				case 'stop': {
					if (!this.client.hotReloadWatcher.isRunning()) {
						embed.setTitle('⚠️ Already Stopped').setDescription('Hot reload watcher is not currently running.').setColor(Colors.HighlightYellow)
					} else {
						await this.client.hotReloadWatcher.stop()
						embed
							.setTitle('🛑 Watcher Stopped')
							.setDescription('Hot reload file watcher has been stopped. Files will no longer be automatically reloaded.')
							.setColor(Colors.SlateGray)
					}
					break
				}

				case 'restart': {
					if (this.client.hotReloadWatcher.isRunning()) {
						await this.client.hotReloadWatcher.stop()
					}
					this.client.hotReloadWatcher.start()

					embed.setTitle('🔄 Watcher Restarted').setDescription('Hot reload file watcher has been restarted.').setColor(Colors.Active)
					break
				}

				case 'blacklist': {
					const blacklist = this.client.hotReloadManager.getBlacklist()

					embed
						.setTitle('🚫 Blacklisted Structures')
						.setDescription(
							blacklist.length > 0
								? `The following structures are blacklisted from hot reloading:\\n\`\`\`\\n${blacklist.join('\\n')}\`\`\``
								: 'No structures are currently blacklisted.'
						)
						.addFields({
							name: 'Note',
							value: 'Blacklisted structures require a full bot restart to reload safely.',
							inline: false
						})
						.setColor(Colors.SlateGray)
					break
				}

				default: {
					embed
						.setTitle('❌ Invalid Action')
						.setDescription('Valid actions: `status`, `start`, `stop`, `restart`, `blacklist`')
						.setColor(Colors.Critical)
					break
				}
			}

			return sendFn({ embeds: [embed] })
		} catch (error) {
			embed
				.setTitle('❌ Watcher Error')
				.setDescription(`An error occurred:\\n\`\`\`\\n${error instanceof Error ? error.message : String(error)}\`\`\``)
				.setColor(Colors.Critical)

			return sendFn({ embeds: [embed] })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('hotwatch')
				.setDescription('Manage the hot reload file watcher system.')
				.addStringOption((option) =>
					option
						.setName('action')
						.setDescription('Action to perform')
						.setRequired(true)
						.addChoices(
						{ name: 'Status', value: 'status' },
						{ name: 'Start', value: 'start' },
						{ name: 'Stop', value: 'stop' },
						{ name: 'Restart', value: 'restart' },
						{ name: 'Show Blacklist', value: 'blacklist' }
					)
				)
		)
	}
}
