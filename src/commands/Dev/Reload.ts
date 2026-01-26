import { ApplyOptions } from '@sapphire/decorators'
import { Args, Command } from '@sapphire/framework'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
	name: 'reload',
	aliases: ['hotreload', 'hr'],
	description: 'Hot reload tasks, structures, or models without restarting the bot.',
	detailedDescription:
		'Hot reloads various bot components:\n• Tasks: Reload individual or all tasks\n• Structures: Reload non-blacklisted structures\n• Models: Reload database models\n• Commands/Events: Use built-in Sapphire reloading',
	usage: 'reload <type> [name]',
	examples: [
		{ example: 'reload task getcatpicture', description: 'Reload a specific task' },
		{ example: 'reload tasks --all', description: 'Reload all tasks' },
		{ example: 'reload structure EventLogger', description: 'Reload a structure' },
		{ example: 'reload model Settings', description: 'Reload a database model' },
		{ example: 'reload command ping', description: 'Reload a command' },
		{ example: 'reload load-structure NewManager', description: 'Load a newly created structure' },
		{ example: 'reload load-model NewModel', description: 'Load a newly created model' },
		{ example: 'reload blacklist', description: 'Show current blacklisted structures' }
	],
	options: ['name'],
	flags: ['all'],
	preconditions: ['OwnerOnly']
})
export class Reload extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const type = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		const name = args.getOption('name') || (await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null)))
		const all = args.getFlags('all')

		return this.handleReload(type, name, all, (content) => (message.channel as TextChannel).send(content))
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const type = interaction.options.getString('type', true)
		const name = interaction.options.getString('name')
		const all = interaction.options.getBoolean('all') || false

		return this.handleReload(type, name, all, (content) => interaction.reply(content))
	}

	private async handleReload(type: string | null, name: string | null, all: boolean, sendFn: (content: any) => Promise<any>) {
		if (!type) {
			return sendFn({
				content: 'Please specify what to reload: `task`, `tasks`, `structure`, `model`, `command`, `event`, or `blacklist`'
			})
		}

		const embed = new EmbedBuilder().setColor(Colors.Blurple)

		try {
			switch (type.toLowerCase()) {
				case 'task': {
					if (!name) return sendFn({ content: 'Please specify a task name to reload.' })

					const success = await this.client.tasks.reloadTask(name)

					embed
						.setTitle('🔄 Task Reload')
						.setDescription(success ? `✅ Successfully reloaded task: \`${name}\`` : `❌ Failed to reload task: \`${name}\``)
						.setColor(success ? Colors.Active : Colors.Critical)
					break
				}

				case 'tasks': {
					if (all) {
						const results = await this.client.tasks.reloadAllTasks()

						embed
							.setTitle('🔄 All Tasks Reload')
							.setDescription(
								`✅ Successfully reloaded: ${results.success} tasks` + (results.failed.length > 0 ? `\\n❌ Failed: ${results.failed.join(', ')}` : '')
							)
							.setColor(results.failed.length === 0 ? Colors.Active : Colors.HighlightYellow)
					} else {
						return sendFn({ content: 'Use `--all` flag to reload all tasks.' })
					}
					break
				}

				case 'structure': {
					if (!name) {
						return sendFn({ content: 'Please specify a structure name to reload.' })
					}

					const result = await this.client.hotReloadManager.reloadStructure(name)

					embed
						.setTitle('🔄 Structure Reload')
						.setDescription(result.success ? `✅ ${result.message}` : `❌ ${result.message}`)
						.setColor(result.success ? Colors.Active : Colors.Critical)
					break
				}

				case 'model': {
					if (!name) {
						return sendFn({ content: 'Please specify a model name to reload.' })
					}

					const result = await this.client.hotReloadManager.reloadModel(name)

					embed
						.setTitle('🔄 Model Reload')
						.setDescription(result.success ? `✅ ${result.message}` : `❌ ${result.message}`)
						.setColor(result.success ? Colors.HighlightYellow : Colors.Critical)
					break
				}

				case 'command': {
					if (!name) {
						return sendFn({ content: 'Please specify a command name to reload.' })
					}

					const command = this.client.stores.get('commands').get(name.toLowerCase())
					if (!command) {
						embed.setTitle('❌ Command Not Found').setDescription(`Command \`${name}\` not found.`).setColor(Colors.Critical)
					} else {
						await command.reload()
						embed.setTitle('🔄 Command Reload').setDescription(`✅ Successfully reloaded command: \`${name}\``).setColor(Colors.Active)
					}
					break
				}

				case 'event':
				case 'listener': {
					if (!name) {
						return sendFn({ content: 'Please specify an event/listener name to reload.' })
					}

					const listener = this.client.stores.get('listeners').get(name.toLowerCase())
					if (!listener) {
						embed.setTitle('❌ Event/Listener Not Found').setDescription(`Event/Listener \`${name}\` not found.`).setColor(Colors.Critical)
					} else {
						await listener.reload()
						embed.setTitle('🔄 Event/Listener Reload').setDescription(`✅ Successfully reloaded event/listener: \`${name}\``).setColor(Colors.Active)
					}
					break
				}

				case 'load-structure': {
					if (!name) {
						return sendFn({ content: 'Please specify a structure name to load.' })
					}

					const result = await this.client.hotReloadManager.loadNewStructure(name)

					embed
						.setTitle('✨ Load New Structure')
						.setDescription(result.success ? `✅ ${result.message}` : `❌ ${result.message}`)
						.setColor(result.success ? Colors.Active : Colors.Critical)
					break
				}

				case 'load-model': {
					if (!name) {
						return sendFn({ content: 'Please specify a model name to load.' })
					}

					const result = await this.client.hotReloadManager.loadNewModel(name)

					embed
						.setTitle('✨ Load New Model')
						.setDescription(result.success ? `✅ ${result.message}` : `❌ ${result.message}`)
						.setColor(result.success ? Colors.Active : Colors.Critical)
					break
				}

				case 'blacklist': {
					const blacklist = this.client.hotReloadManager.getBlacklist()

					embed
						.setTitle('🚫 Hot Reload Blacklist')
						.setDescription(
							blacklist.length > 0 ? `Blacklisted structures:\\n\`\`\`\\n${blacklist.join('\\n')}\`\`\`` : 'No structures are currently blacklisted.'
						)
						.setColor(Colors.SlateGray)
					break
				}

				default: {
					return sendFn({
						content: 'Invalid type. Use: `task`, `tasks`, `structure`, `model`, `command`, `event`, `load-structure`, `load-model`, or `blacklist`'
					})
				}
			}

			return sendFn({ embeds: [embed] })
		} catch (error) {
			embed
				.setTitle('❌ Reload Error')
				.setDescription(`An error occurred during reload:\\n\`\`\`\\n${error instanceof Error ? error.message : String(error)}\`\`\``)
				.setColor(Colors.Critical)

			return sendFn({ embeds: [embed] })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('reload')
				.setDescription('Hot reload tasks, structures, or models without restarting the bot.')
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('Type of component to reload')
						.setRequired(true)
						.addChoices(
						{ name: 'Task', value: 'task' },
						{ name: 'All Tasks', value: 'tasks' },
						{ name: 'Structure', value: 'structure' },
						{ name: 'Model', value: 'model' },
						{ name: 'Command', value: 'command' },
						{ name: 'Event/Listener', value: 'event' },
						{ name: 'Load New Structure', value: 'load-structure' },
						{ name: 'Load New Model', value: 'load-model' },
						{ name: 'Show Blacklist', value: 'blacklist' }
					)
				)
				.addStringOption((option) =>
					option
						.setName('name')
						.setDescription('Name of the component to reload')
						.setRequired(false)
				)
				.addBooleanOption((option) =>
					option
						.setName('all')
						.setDescription('Reload all components of the specified type')
						.setRequired(false)
				)
		)
	}
}
