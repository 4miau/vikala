import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'
import { spawn } from 'child_process'
import ms from 'ms'

@ApplyOptions<Command.Options>({
	name: 'exec',
	aliases: [],
	description: 'Executes arbitrary code.'
})
export class Exec extends Command {
	private client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const command = await args.restResult('string').then((res) => (res.isOk() ? res.unwrap() : null))
		if (!command) return message.channel.send('Please provide a command to execute.')

		const startTime = Date.now()
		const reply = await message.channel.send(`\`\`\`\nExecuting: ${command}\n\`\`\``)

		try {
			const child = spawn('bash', ['-c', command], { timeout: ms('30s') })

			let stdout = ''
			let stderr = ''

			child.stdout?.on('data', (data) => {
				stdout += data.toString()
			})

			child.stderr?.on('data', (data) => {
				stderr += data.toString()
			})

			child.on('close', (code) => {
				const executionTime = Date.now() - startTime
				let output = ''

				if (stdout) output += `**STDOUT:**\n\`\`\`\n${stdout.slice(0, 1900)}\n\`\`\``
				if (stderr) output += `${stdout ? '\n\n' : ''}**STDERR:**\n\`\`\`\n${stderr.slice(0, 1900)}\n\`\`\``

				if (!stdout && !stderr) output = '*(No output)*'

				output += `\n\n**Exit Code:** \`${code}\` | **Time:** \`${executionTime}ms\``

				reply.edit(output.slice(0, 2000))
			})

			child.on('error', (error) => {
				reply.edit(`\`\`\`\nError executing command: ${error.message}\n\`\`\``)
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			reply.edit(`\`\`\`\nFailed to execute command: ${errorMessage}\n\`\`\``)
		}
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('exec')
				.setDescription('Executes arbitrary code.')
				.addStringOption((option) =>
					option
						.setName('command')
						.setDescription('The command to execute')
						.setRequired(true)
				)
		)
	}
}
