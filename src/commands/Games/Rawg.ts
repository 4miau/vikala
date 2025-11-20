import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, TextChannel, type Message } from 'discord.js'
import { Subcommand } from '@sapphire/plugin-subcommands'

import { RawgGame, RawgGameResult } from '../../typings/@definitions/Rawg'
import { getInput } from '../../lib/util/utilities'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'rawg',
    aliases: ['rawggame'],
    description: 'Get game information from RAWG API',
    detailedDescription: 'Search for games or get detailed information about a game using its RAWG ID, not steam ID. When searching, you will be prompted to select from a list of results.',
    usage: 'rawg <search> <gameName> | <id>',
    examples: [
        { example: 'rawg search The Witcher 3', description: 'Search for games with the name "The Witcher 3".' },
        { example: 'rawg id 29203', description: 'Get detailed information about the game with ID 29203.' }
    ],
    subcommands: [
        { name: 'search', messageRun: 'rawgMsgSearch', chatInputRun: 'rawgInputSearch', default: true },
        { name: 'id', messageRun: 'rawgMsgById', chatInputRun: 'rawgInputById' }
    ]
})
export class Rawg extends Subcommand {
    client = this.container.client
    fetchGamesTask = this.client.tasks.get('rawggamesearch')
    fetchGameTask = this.client.tasks.get('rawggamebyid')

    public async rawgMsgSearch(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const game = await args.restResult('string').then(res => res.isOk ? res.unwrap() : null)
        if (!game) return message.channel.send({ content: 'Provide a valid game name.' })

        return this.handleGameSearch(game, {
            sendMessage: (content) => (message.channel as TextChannel).send(content),
            userId: message.author.id,
            channel: message.channel
        })
    }

    public async rawgInputSearch(interaction: Subcommand.ChatInputCommandInteraction) {
        const game = interaction.options.getString('game', true)

        return this.handleGameSearch(game, {
            sendMessage: (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }),
            userId: interaction.user.id,
            channel: interaction.channel!,
            isInteraction: true
        })
    }

    public async rawgMsgById(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const gameId = await args.rest('string').catch(null)
        if (!gameId) return message.channel.send({ content: 'Provide a valid game ID.' })

        return this.handleGameById(gameId, (content) => (message.channel as TextChannel).send(content))
    }

    public async rawgInputById(interaction: Subcommand.ChatInputCommandInteraction) {
        const gameId = interaction.options.getString('game_id', true)

        return this.handleGameById(gameId, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
    }

    private async handleGameSearch(gameName: string, context: {
        sendMessage: (content: any) => Promise<any>
        userId: string
        channel: any
        isInteraction?: boolean
    }) {
        const gamesList: RawgGameResult[] = await this.fetchGamesTask.exec(gameName)
        if (!gamesList || gamesList.length === 0) {
            return context.sendMessage({ content: 'No games found.' })
        }

        try {
            const options = this.buildGameSelectionMessage(gamesList)

            if (context.isInteraction) {
                context.sendMessage({ content: options })
                const selectedGame = Number(getInput(context.channel, { userId: context.userId, deleteAfter: true }))
                const gameInfo = await this.fetchGameTask.exec(gamesList[selectedGame - 1].id)
                if (!gameInfo) return context.sendMessage({ content: 'Game information could not be retrieved.' })

                const embed = this.rawgGameEmbed(gameInfo)
                return context.sendMessage({ embeds: [embed] })
            } else {
                context.sendMessage({ content: options })
                const selectedGame = Number(await getInput(context.channel, { userId: context.userId }))
                const gameInfo = await this.fetchGameTask.exec(gamesList[selectedGame - 1].id)
                if (!gameInfo) return context.sendMessage({ content: 'Game information could not be retrieved.' })

                const embed = this.rawgGameEmbed(gameInfo)
                return context.sendMessage({ embeds: [embed] })
            }
        } catch (err) {
            if (!context.isInteraction) console.log(err)
            return context.sendMessage({ content: 'A valid game was not selected, please try again.' })
        }
    }

    private async handleGameById(gameId: string, sendFn: (content: any) => Promise<any>) {
        const gameInfo: RawgGame = await this.fetchGameTask.exec(gameId)
        if (!gameInfo) return sendFn({ content: 'Game information could not be retrieved.' })

        const embed = this.rawgGameEmbed(gameInfo)
        return sendFn({ embeds: [embed] })
    }

    private buildGameSelectionMessage(games: RawgGameResult[]): string {
        return `Select a game by typing the corresponding number:\n${games.map((game, i) => `*${i + 1}.* ${game.name} (${game.released})`).join('\n')}` +
            `\n\nPlease select between \`1\` and \`${games.length}\`.`
    }

    private rawgGameEmbed(game: RawgGame): EmbedBuilder {
        return new EmbedBuilder()
            .setAuthor({ name: game.name, url: `${game.website || ''}` })
            .setDescription(game.description_raw.length > 2048 ? `${game.description_raw.slice(0, 2045)}...` : game.description_raw)
            .setColor(Colors.SlateGray)
            .addFields([
                { name: 'Released', value: String(!game.tba), inline: true },
                { name: 'Release Date', value: game.tba ? 'TBA' : game.released, inline: true },
                { name: 'Metacritic Score', value: String(game.metacritic) || 'N/A', inline: true },
                { name: 'Genres', value: game.genres.map((genre) => genre.name).join(', ') || 'N/A', inline: false },
                { name: 'Platforms', value: game.platforms.map((platform) => platform.platform.name).join(', ') || 'N/A', inline: false },
                { name: 'Developers', value: game.developers.map((dev) => dev.name).join(', ') || 'N/A', inline: true },
                { name: 'Publishers', value: game.publishers.map((pub) => pub.name).join(', ') || 'N/A', inline: true }
            ])
            .setImage(game.background_image)
            .setFooter({ text: `Data provided by RAWG.io | ID: ${game.id}` })
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('rawg')
                .setDescription('Get game information from RAWG API')
                .addSubcommand((sub) =>
                    sub
                        .setName('search')
                        .setDescription('Search for a game')
                        .addStringOption((option) =>
                            option
                                .setName('game')
                                .setDescription('The game to search for')
                                .setRequired(true)
                        )
                )
                .addSubcommand((sub) =>
                    sub
                        .setName('id')
                        .setDescription('Get game information by RAWG game ID')
                        .addStringOption((option) =>
                            option
                                .setName('game_id')
                                .setDescription('The RAWG game ID')
                                .setRequired(true)
                        )
                )
        )
    }
}