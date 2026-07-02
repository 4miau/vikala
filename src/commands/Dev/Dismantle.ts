import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message, TextChannel } from 'discord.js'

declare type ModuleType = 'command' | 'listener' | 'precondition' | 'task' | 'arguments'

@ApplyOptions<Command.Options>({
	name: 'dismantle',
	aliases: ['unbuild'],
	description: 'Dismantles and unloads a file loaded on the bot.',
	usage: 'dismantle <file> <type>',
	examples: [{ example: 'dismantle ping command', description: 'Dismantles the command named ping and unloads it from the bot.' }],
	preconditions: ['OwnerOnly']
})
export class Dismantle extends Command {
	private client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const file: string = await args.pickResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!file) return message.channel.send({ content: 'Provide a file/module to dismantle.' })

		const type: ModuleType = (await args
			.pickResult('enum', { enum: ['command', 'listener', 'precondition', 'task', 'arguments'] })
			.then((res) => (res.isOk() ? res.unwrap() : null))) as ModuleType
		if (!type) return message.channel.send({ content: 'Provide a type of module to dismantle.' })

		return this.handleDismantleModule(file, type, (content) => (message.channel as TextChannel).send(content))
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const file = interaction.options.getString('file', true)
		const type = interaction.options.getString('type', true) as ModuleType

		return this.handleDismantleModule(file, type, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
	}

	private async handleDismantleModule(file: string, type: ModuleType, sendFn: (content: any) => Promise<any>) {
		const moduleStores = {
			command: this.client.commandStore,
			listener: this.client.listenerStore,
			precondition: this.client.preconditions,
			task: this.client.tasks,
			arguments: this.client.arguments
		}

		const store = moduleStores[type]
		if (!store) return sendFn({ content: 'Invalid module type provided.' })

		try {
			await store.get(file).unload()
			return sendFn({ content: `${type.charAt(0).toUpperCase() + type.slice(1)} \`${file}\` has been dismantled.` })
		} catch {
			return sendFn({ content: `Failed to dismantle ${type} \`${file}\` or it does not exist.` })
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('dismantle')
				.setDescription('Dismantles and unloads a file loaded on the bot.')
				.addStringOption((option) => option.setName('file').setDescription('The file/module to dismantle.').setRequired(true))
				.addStringOption((option) =>
					option
						.setName('type')
						.setDescription('The type of module to dismantle.')
						.setRequired(true)
						.addChoices(
							{ name: 'Command', value: 'command' },
							{ name: 'Listener', value: 'listener' },
							{ name: 'Precondition', value: 'precondition' },
							{ name: 'Task', value: 'task' },
							{ name: 'Arguments', value: 'arguments' }
						)
				)
		)
	}
}
