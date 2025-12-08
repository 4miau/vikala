import { ApplyOptions } from '@sapphire/decorators'
import { Args, Command } from '@sapphire/framework'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { arrayRandom } from 'miau-utilities'

@ApplyOptions<Command.Options>({
    name: 'animequote',
    aliases: ['aquote'],
    description: 'Returns a random anime quote.\nAccepts either flag:\n--char=(Character)\n--show=(Name of anime)',
    detailedDescription: 'Fetches a random anime quote. You can specify a character or a show to get quotes related to them.\nAccepts either flag:\n--char=(Character)\n--show=(Name of anime)',
    options: ['character', 'char', 'show'],
    usage: 'animequote [--char=(Character)] | [--show=(Name of anime)]',
    examples: [
        { example: 'animequote', description: 'Will return a random anime quote' },
        { example: 'animequote --char=Naruto', description: 'Will return a random quote from the character Naruto' },
        { example: 'aquote "--char=Gon Freecss"', description: 'Will return a random quote from Gon Freecss from Hunter x Hunter' },
        { example: 'animequote --show=Naruto', description: 'Will return a random quote from the anime Naruto' }
    ]
})
export class AnimeQuote extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const character = args.getOption('char', 'character') ?? undefined
        const show = args.getOption('show') ?? undefined

        return this.handleAnimeQuote(character, show, (content) => (message.channel as TextChannel).send(content))
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const character = interaction.options.getString('character') || undefined
        const show = interaction.options.getString('show') || undefined

        return this.handleAnimeQuote(character, show, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
    }

    private async handleAnimeQuote(character: string | null, show: string | null, sendFn: (content: any) => Promise<any>) {
        const random = 'random=1'
        let quotes: AnimeQuoteResponse[] = null

        try {
            if (character) quotes = await this.client.tasks.get('getanimequote').exec('character', character)
            else if (show) quotes = await this.client.tasks.get('getanimequote').exec('show', show)
            else quotes = await this.client.tasks.get('getanimequote').exec(random)

            if (!quotes || quotes.length === 0) {
                return sendFn({ content: 'No quotes found for the specified criteria.' })
            }

            const quote = arrayRandom(quotes)
            const embed = new EmbedBuilder()
                .setTitle(`Anime Quote | ${quote?.show || 'Unknown'}`)
                .setDescription(quote.quote)
                .setFooter({ text: `from ${quote.character}` })

            return sendFn({ embeds: [embed] })
        } catch {
            return sendFn({ content: 'Failed to fetch anime quote. Please try again later.' })
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('animequote')
                .setDescription('Returns a random anime quote.\nAccepts either flag:\n--char=(Character)\n--show=(Name of anime)')
                .addStringOption((option) => {
                    return option
                        .setName('character')
                        .setDescription('The character to get a quote from')
                        .setRequired(false)
                })
                .addStringOption((option) => {
                    return option
                        .setName('show')
                        .setDescription('The show to get a quote from')
                        .setRequired(false)
                })
        )
    }
}