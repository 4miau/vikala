import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'
import { arrayRandom } from 'miau-utilities'

@ApplyOptions<Command.Options>({
    name: 'coinflip',
    aliases: ['cf'],
    description: 'Flip a coin',
    usage: 'coinflip [choice]',
    examples: [
        { example: 'coinflip', description: 'Will just flip a coin without choosing.' },
        { example: 'coinflip tails', description: 'Flip a coin and choose tails. Better luck next time!' }
    ]
})
export class Coinflip extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const outcomes = ['Heads', 'Tails']
        const choice: String = await args.pickResult('string').then(res => res.isOk ? res.unwrap() : null)

        if (!choice || ['h', 'heads', 'tails', 't'].includes(choice.toLowerCase())) {
            return message.channel.send({ content: `🎲 The coin landed on: ${arrayRandom(outcomes)}` })
        }

        const won: boolean = choice.toLowerCase().startsWith(arrayRandom(outcomes).toLowerCase())

        if (won) return message.channel.send({ content: `🎲 You won! The coin landed on: ${choice}` })
        else return message.channel.send({ content: `🎲 You lost! The coin landed on: ${choice}` })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const outcomes = ['Heads', 'Tails']
        const choice = interaction.options.getString('choice')

        if (!choice || ['h', 'heads', 'tails', 't'].includes(choice.toLowerCase())) {
            return interaction.reply({ content: `🎲 The coin landed on: ${arrayRandom(outcomes)}` })
        }

        const won: boolean = choice.toLowerCase().startsWith(arrayRandom(outcomes).toLowerCase())

        if (won) return interaction.reply({ content: `🎲 You won! The coin landed on: ${choice}` })
        else return interaction.reply({ content: `🎲 You lost! The coin landed on: ${choice}` })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('coinflip')
                .setDescription('Flip a coin')
                .addStringOption((option) =>
                    option
                        .setName('choice')
                        .setDescription('Your choice: heads or tails')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Heads', value: 'heads' },
                            { name: 'Tails', value: 'tails' }
                        )
                )
        )
    }
}