import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

import { eightBallReplies } from '../../lib/util/constants'
import { arrayRandom } from 'miau-utilities'

@ApplyOptions<Command.Options>({
	name: '8ball',
	aliases: ['8b'],
	description: 'Ask the magic 8ball a question',
	usage: '8ball <question>',
	examples: [
		{ example: '8ball Will I win the lottery?', description: 'Asks the magic 8ball if you will win the lottery. I mean the answer is yes obviously.' }
	]
})
export class EightBall extends Command {
	client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const question = await args.restResult('string').then((res) => (res.isOk ? res.unwrap() : null))
		if (!question) return message.channel.send({ content: 'What are you asking the 8ball?' })

		return message.channel.send({ content: `🎱 ${arrayRandom(eightBallReplies)}` })
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		interaction.options.getString('question', true)
		return interaction.reply({ content: `🎱 ${arrayRandom(eightBallReplies)}` })
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('8ball')
				.setDescription('Ask the magic 8ball a question')
				.addStringOption((option) => option.setName('question').setDescription('The question you want to ask the 8ball').setRequired(true))
		)
	}
}
