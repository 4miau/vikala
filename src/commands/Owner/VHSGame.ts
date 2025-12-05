import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, InteractionCallbackResponse, PermissionFlagsBits, TextChannel, type Message } from 'discord.js'
import { Subcommand } from '@sapphire/plugin-subcommands'

import { getInput } from '../../lib/util/utilities'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'vhsgame',
    aliases: ['vhs', 'vhsarchive'],
    description: 'View and manage VHS Archive games',
    detailedDescription: 'Search for games in the GAMES LIBRARY or GAMES ARCHIVE, and transfer games from library to archive. ' +
    'When searching, you will be prompted to select from a list of results if multiple matches are found.\n' +
    '**Note:** When querying by ID, you will need to *-2* to account for the header rows (e.g. If the game is on row 50, use ID 48).',
    usage: 'vhsgame <library|archive> <view|transfer> <game name|game ID>',
    examples: [
        { example: 'vhsgame library view Pizza Tower', description: 'Search for "Pizza Tower" in the GAMES LIBRARY.' },
        { example: 'vhsgame archive view 15', description: 'View game at index 15 in the GAMES ARCHIVE.' },
        { example: 'vhsgame library transfer 42', description: 'Transfer game at index 42 from GAMES LIBRARY to GAMES ARCHIVE.' },
        { example: 'vhsgame archive transfer 7', description: 'Transfer game at index 7 from GAMES ARCHIVE to GAMES LIBRARY.' },
        { example: 'vhsgame library view latest', description: 'View the most recently added game in the GAMES LIBRARY.' },
        { example: 'vhsgame archive view latest', description: 'View the most recently added game in the GAMES ARCHIVE.' }
    ],
    requiredUserPermissions: [PermissionFlagsBits.ManageGuild],
    subcommands: [
        {
            name: 'library',
            type: 'group',
            entries: [
                { name: 'view', messageRun: 'libraryViewMsg', chatInputRun: 'libraryViewInput', default: true },
                { name: 'transfer', messageRun: 'libraryTransferMsg', chatInputRun: 'libraryTransferInput' }
            ]
        },
        {
            name: 'archive',
            type: 'group',
            entries: [
                { name: 'view', messageRun: 'archiveViewMsg', chatInputRun: 'archiveViewInput' },
                { name: 'transfer', messageRun: 'archiveTransferMsg', chatInputRun: 'archiveTransferInput' }
            ]
        }
    ]
})
export class VHSGame extends Subcommand {
    client = this.container.client

    public async libraryViewMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const query = await args.restResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!query) return message.channel.send({ content: 'Please provide a game name or ID to search for.' })

        return this.handleGameView('GAMES LIBRARY', query, {
            sendMessage: (content) => (message.channel as TextChannel).send(content),
            userId: message.author.id,
            channel: message.channel
        })
    }

    public async libraryViewInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const query = interaction.options.getString('query', true)

        return this.handleGameView('GAMES LIBRARY', query, {
            sendMessage: (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }),
            userId: interaction.user.id,
            channel: interaction.channel!,
            isInteraction: true
        })
    }

    public async archiveViewMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const query = await args.restResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!query) return message.channel.send({ content: 'Please provide a game name or ID to search for.' })

        return this.handleGameView('GAMES ARCHIVE', query, {
            sendMessage: (content) => (message.channel as TextChannel).send(content),
            userId: message.author.id,
            channel: message.channel
        })
    }

    public async archiveViewInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const query = interaction.options.getString('query', true)

        return this.handleGameView('GAMES ARCHIVE', query, {
            sendMessage: (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }),
            userId: interaction.user.id,
            channel: interaction.channel!,
            isInteraction: true
        })
    }

    public async libraryTransferMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const gameId = await args.restResult('number').then(res => res.isOk() ? res.unwrap() : null)
        if (gameId === null) return message.channel.send({ content: 'Please provide a valid game ID (number).' })

        return this.handleGameTransfer(gameId, 'GAMES LIBRARY', {
            sendMessage: (content) => (message.channel as TextChannel).send(content),
            userId: message.author.id,
            channel: message.channel
        })
    }

    public async libraryTransferInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const gameId = interaction.options.getInteger('game_id', true)

        return this.handleGameTransfer(gameId, 'GAMES LIBRARY', {
            sendMessage: (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }),
            userId: interaction.user.id,
            channel: interaction.channel!,
            isInteraction: true
        })
    }

    public async archiveTransferMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const gameId = await args.restResult('number').then(res => res.isOk() ? res.unwrap() : null)
        if (gameId === null) return message.channel.send({ content: 'Please provide a valid game ID (number).' })

        return this.handleGameTransfer(gameId, 'GAMES ARCHIVE', {
            sendMessage: (content) => (message.channel as TextChannel).send(content),
            userId: message.author.id,
            channel: message.channel
        })
    }

    public async archiveTransferInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const gameId = interaction.options.getInteger('game_id', true)

        return this.handleGameTransfer(gameId, 'GAMES ARCHIVE', {
            sendMessage: (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }),
            userId: interaction.user.id,
            channel: interaction.channel!,
            isInteraction: true
        })
    }

    private async handleGameView(sheetTitle: string, query: string, context: {
        sendMessage: (content: any) => Promise<Message | InteractionCallbackResponse>
        userId: string
        channel: any
        isInteraction?: boolean
    }) {
        const isNumeric = /^\d+$/.test(query)
        const isLatest = query.toLowerCase() === 'latest'

        const loadingMsg = await context.sendMessage({ content: '🔄 Loading...' })

        try {
            if (isNumeric || isLatest) {
                const gameIndex = isLatest
                    ? await this.client.sheets.getLatestGameIndex(sheetTitle)
                    : parseInt(query)

                if (gameIndex === null) {
                    if ('edit' in loadingMsg) return loadingMsg.edit({ content: `No games found in ${sheetTitle}.` })
                    return context.sendMessage({ content: `No games found in ${sheetTitle}.` })
                }

                const game = await this.client.sheets.getGameByRowIndex(sheetTitle, gameIndex)

                if (!game || !game.data.name) {
                    if ('edit' in loadingMsg) return loadingMsg.edit({ content: `No game found at index ${gameIndex} in ${sheetTitle}.` })
                    return context.sendMessage({ content: `No game found at index ${gameIndex} in ${sheetTitle}.` })
                }

                const embed = this.buildGameEmbed(game.data, sheetTitle, gameIndex)
                if ('edit' in loadingMsg) return loadingMsg.edit({ content: '', embeds: [embed] })
                return context.sendMessage({ embeds: [embed] })
            } else {
                const games = await this.client.sheets.findGamesByName(sheetTitle, query)

                if (!games || games.length === 0) {
                    if ('edit' in loadingMsg) return loadingMsg.edit({ content: `No games found matching "${query}" in ${sheetTitle}.` })
                    return context.sendMessage({ content: `No games found matching "${query}" in ${sheetTitle}.` })
                }

                if (games.length === 1) {
                    const embed = this.buildGameEmbed(games[0].data, sheetTitle, games[0].rowIndex)
                    if ('edit' in loadingMsg) return loadingMsg.edit({ content: '', embeds: [embed] })
                    return context.sendMessage({ embeds: [embed] })
                }

                const options = this.buildGameSelectionMessage(games, sheetTitle)

                if (context.isInteraction) {
                    if ('edit' in loadingMsg) await loadingMsg.edit({ content: options })
                    else await context.sendMessage({ content: options })
                    const selection = await getInput(context.channel, { userId: context.userId, deleteAfter: true })
                    const selectedIndex = Number(selection)

                    if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > games.length) {
                        return context.sendMessage({ content: 'Invalid selection. Please try again.' })
                    }

                    const selectedGame = games[selectedIndex - 1]
                    const embed = this.buildGameEmbed(selectedGame.data, sheetTitle, selectedGame.rowIndex)
                    return context.sendMessage({ embeds: [embed] })
                } else {
                    if ('edit' in loadingMsg) await loadingMsg.edit({ content: options })
                    else await context.sendMessage({ content: options })
                    const selection = await getInput(context.channel, { userId: context.userId })
                    const selectedIndex = Number(selection)

                    if (isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > games.length) {
                        return context.sendMessage({ content: 'Invalid selection. Please try again.' })
                    }

                    const selectedGame = games[selectedIndex - 1]
                    const embed = this.buildGameEmbed(selectedGame.data, sheetTitle, selectedGame.rowIndex)
                    return context.sendMessage({ embeds: [embed] })
                }
            }
        } catch (err) {
            console.error('Error in handleGameView:', err)
            if ('edit' in loadingMsg) return loadingMsg.edit({ content: 'An error occurred while searching for games. Please try again.' })
            return context.sendMessage({ content: 'An error occurred while searching for games. Please try again.' })
        }
    }

    private async handleGameTransfer(gameId: number, sourceSheet: string, context: {
        sendMessage: (content: any) => Promise<any>
        userId: string
        channel: any
        isInteraction?: boolean
    }) {
        const loadingMsg = await context.sendMessage({ content: '🔄 Loading...' })
        const targetSheet = sourceSheet === 'GAMES LIBRARY' ? 'GAMES ARCHIVE' : 'GAMES LIBRARY'

        try {
            const game = await this.client.sheets.getGameByRowIndex(sourceSheet, gameId)

            if (!game || !game.data.name) {
                if ('edit' in loadingMsg) return loadingMsg.edit({ content: `No game found at index ${gameId} in ${sourceSheet}.` })
                return context.sendMessage({ content: `No game found at index ${gameId} in ${sourceSheet}.` })
            }

            const confirmMessage = `Are you sure you want to transfer **${game.data.name}** (ID: ${gameId}) from ${sourceSheet} to ${targetSheet}?\n\nType \`yes\` to confirm or \`no\` to cancel.`
            if ('edit' in loadingMsg) await loadingMsg.edit({ content: confirmMessage })
            else await context.sendMessage({ content: confirmMessage })

            const confirmation = context.isInteraction
                ? await getInput(context.channel, { userId: context.userId, deleteAfter: true })
                : await getInput(context.channel, { userId: context.userId })

            const confirmText = Array.isArray(confirmation) ? confirmation.join(' ') : confirmation
            if (confirmText.toLowerCase() !== 'yes') {
                return context.sendMessage({ content: 'Transfer cancelled.' })
            }

            const transferMsg = await context.sendMessage({ content: '🔄 Transferring game...' })
            if (sourceSheet === 'GAMES LIBRARY') {
                await this.client.sheets.transferGameToArchive(game.data, game.rowIndex)
            } else {
                await this.client.sheets.transferGameToLibrary(game.data, game.rowIndex)
            }

            if ('edit' in transferMsg) return transferMsg.edit({ content: `✅ Successfully transferred **${game.data.name}** to ${targetSheet}.` })
            return context.sendMessage({ content: `✅ Successfully transferred **${game.data.name}** to ${targetSheet}.` })
        } catch (err) {
            console.error('Error in handleGameTransfer:', err)
            if ('edit' in loadingMsg) return loadingMsg.edit({ content: 'An error occurred while transferring the game. Please try again.' })
            return context.sendMessage({ content: 'An error occurred while transferring the game. Please try again.' })
        }
    }

    private buildGameSelectionMessage(games: Array<{ rowIndex: number, data: any }>, sheetTitle: string): string {
        const gameList = games.map((game, i) => {
            const name = game.data.name || 'Unknown'
            const releaseDate = game.data.releaseDate || 'N/A'
            return `*${i + 1}.* ${name} (${releaseDate}) - ID: ${game.rowIndex}`
        }).join('\n')

        return `Multiple games found in ${sheetTitle}. Select a game by typing the corresponding number:\n\n${gameList}\n\nPlease select between \`1\` and \`${games.length}\`.`
    }

    private buildGameEmbed(gameData: any, sheetTitle: string, rowIndex: number): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle(gameData.name)
            .setDescription(gameData.summary || 'No description available.')
            .setColor(Colors.SlateGray)
            .addFields([
                { name: 'Release Date', value: gameData.releaseDate || 'N/A', inline: true },
                { name: 'ID', value: String(rowIndex), inline: true }
            ])
            .setFooter({ text: `${sheetTitle}` })

        if (gameData.url) embed.setURL(gameData.url)

        const reactions = []
        if (sheetTitle === 'GAMES LIBRARY' && gameData.seen === 'TRUE') reactions.push('👁️ Seen')
        if (gameData.liked === 'TRUE') reactions.push('👍 Liked')
        if (gameData.meh === 'TRUE') reactions.push('😐 Meh')
        if (gameData.disliked === 'TRUE') reactions.push('👎 Disliked')
        if (gameData.played === 'TRUE') reactions.push('🎮 Played')

        if (reactions.length > 0) {
            embed.addFields({ name: 'Status', value: reactions.join(' • '), inline: false })
        }

        if (gameData.extras) {
            embed.addFields({ name: 'Extras', value: gameData.extras, inline: false })
        }

        return embed
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('vhsgame')
                .setDescription('View and manage VHS Archive games')
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
                .addSubcommandGroup((group) =>
                    group
                        .setName('library')
                        .setDescription('GAMES LIBRARY operations')
                        .addSubcommand((sub) =>
                            sub
                                .setName('view')
                                .setDescription('View a game from GAMES LIBRARY')
                                .addStringOption((option) =>
                                    option
                                        .setName('query')
                                        .setDescription('Game name or ID to search for')
                                        .setRequired(true)
                                )
                        )
                        .addSubcommand((sub) =>
                            sub
                                .setName('transfer')
                                .setDescription('Transfer a game from GAMES LIBRARY to GAMES ARCHIVE')
                                .addIntegerOption((option) =>
                                    option
                                        .setName('game_id')
                                        .setDescription('The ID of the game to transfer')
                                        .setRequired(true)
                                )
                        )
                )
                .addSubcommandGroup((group) =>
                    group
                        .setName('archive')
                        .setDescription('GAMES ARCHIVE operations')
                        .addSubcommand((sub) =>
                            sub
                                .setName('view')
                                .setDescription('View a game from GAMES ARCHIVE')
                                .addStringOption((option) =>
                                    option
                                        .setName('query')
                                        .setDescription('Game name or ID to search for')
                                        .setRequired(true)
                                )
                        )
                        .addSubcommand((sub) =>
                            sub
                                .setName('transfer')
                                .setDescription('Transfer a game from GAMES ARCHIVE to GAMES LIBRARY')
                                .addIntegerOption((option) =>
                                    option
                                        .setName('game_id')
                                        .setDescription('The ID of the game to transfer')
                                        .setRequired(true)
                                )
                        )
                )
        )
    }
}
