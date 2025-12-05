import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { Message } from 'discord.js'

import Vikala from '../client/vikala'
import creds from '../keys/tien-476418-7db3e64f7a21.json'
import { googleScopes } from '../lib/util/constants'
import { envs } from '../lib/util/environmentVariables'
import { fetchItchioDescription } from '../lib/util/utilities'


export default class Sheets {
    protected client: Vikala
    jwt: JWT
    doc: GoogleSpreadsheet
    private sheets: Map<string, GoogleSpreadsheetWorksheet> = new Map()
    private lastCacheReset: number = 0
    private readonly CACHE_RESET_COOLDOWN = 2000

    constructor(cli: Vikala) {
        this.client = cli
    }

    public async _init() {
        this.jwt = new JWT({ key: creds.private_key, email: creds.client_email, scopes: googleScopes })
        this.doc = new GoogleSpreadsheet(envs.VHS_DOC_ID, this.jwt)
        await this.doc.loadInfo(true)

        this.sheets.set('GAMES LIBRARY', this.doc.sheetsByTitle['GAMES LIBRARY'])
        this.sheets.set('GAMES ARCHIVE', this.doc.sheetsByTitle['GAMES ARCHIVE'])
    }

    public async handleIsVHS(message: Message) {
        const vhsChannelId = this.client.settings.get('global', 'vhsChannel', null)

        if (!message.inGuild() || message.author.bot) return
        if (!vhsChannelId || message.channel.id !== vhsChannelId) return

        if (message.content.includes('steampowered') || message.content.includes('itch.io')) {
            await this.addVHSEntry(message.content)
        }
    }

    private async getSheetIndex(): Promise<number> {
        const librarySheet = this.sheets.get('GAMES LIBRARY')
        if (!librarySheet) return -1

        const now = Date.now()
        if (now - this.lastCacheReset > this.CACHE_RESET_COOLDOWN) {
            await this.resetCache(librarySheet)
            this.lastCacheReset = now
        }

        const rows = await librarySheet.getRows({ offset: 1 })
        return rows.findIndex(row => row.rowNumber > 1 && !row['_rawData'][0] && !row['_rawData'][1]) + 2
    }

    public async accessSpreadsheet(spreadsheetId: string): Promise<GoogleSpreadsheet> {
        this.doc = new GoogleSpreadsheet(spreadsheetId, this.jwt)
        await this.doc.loadInfo(true)

        return this.doc
    }

    async addVHSEntry(gameLink: string) {
        return this.client.queue.add(async () => {
            const sheetIndex = await this.getSheetIndex()

            if (sheetIndex <= 1) return

            if (gameLink.includes('steampowered')) await this.addSteamEntry(gameLink, sheetIndex)
            else if (gameLink.includes('itch.io')) await this.addItchEntry(gameLink, sheetIndex)
        })
    }

    private async addSteamEntry(gameLink: string, sheetIndex: number) {
        const librarySheet = this.sheets.get('GAMES LIBRARY')
        if (!librarySheet) return

        const gameId = gameLink.split('/').find(part => /^\d+$/.test(part))
        const game: SteamGame = await this.client.tasks.get('getsteamgame').exec(gameId)

        const updates = [
            { row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink}", "${game.name}")` },
            { row: sheetIndex, col: 1, value: game.short_description },
            { row: sheetIndex, col: 2, value: game.release_date.date?.replace(',', '') },
            { row: sheetIndex, col: 8, value: `From Steam, price: ${game.is_free ? 'Free to Play' : game.price_overview?.final_formatted || 'N/A'}` }
        ]

        updates.forEach(update => {
            const cell = librarySheet.getCell(update.row, update.col)
            if (update.formula) cell.formula = update.formula
            else cell.value = update.value
        })

        await librarySheet.saveUpdatedCells()
    }

    private async addItchEntry(gameLink: string, sheetIndex: number) {
        const librarySheet = this.sheets.get('GAMES LIBRARY')
        if (!librarySheet) return

        const game: ItchioGame = await this.client.tasks.get('getitchiogame').exec(gameLink)
        const description = await fetchItchioDescription(gameLink)

        const updates = [
            { row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink}", "${game.title}")` },
            { row: sheetIndex, col: 1, value: description },
            { row: sheetIndex, col: 8, value: `From itch.io, price: ${game.price}` }
        ]

        updates.forEach(update => {
            const cell = librarySheet.getCell(update.row, update.col)
            if (update.formula) cell.formula = update.formula
            else cell.value = update.value
        })

        await librarySheet.saveUpdatedCells()
    }

    private async resetCache(sheet: GoogleSpreadsheetWorksheet) {
        const now = Date.now()
        if (now - this.lastCacheReset < this.CACHE_RESET_COOLDOWN) return

        sheet.resetLocalCache()
        await this.doc.loadInfo(true)
        this.lastCacheReset = now
    }

    public async getSheet(sheetId: number): Promise<GoogleSpreadsheetWorksheet> {
        return this.doc.sheetsById[sheetId]
    }

    public getSheetByTitle(title: string): GoogleSpreadsheetWorksheet | undefined {
        return this.sheets.get(title)
    }

    public async findGamesByName(sheetTitle: string, gameName: string): Promise<Array<{ rowIndex: number, data: any }>> {
        const sheet = this.sheets.get(sheetTitle)
        if (!sheet) return []

        await this.resetCache(sheet)
        const rows = await sheet.getRows()

        const matches: Array<{ rowIndex: number, data: any }> = []
        const searchTerm = gameName.toLowerCase()

        rows.forEach((row) => {
            const name = row.get('Name') || row['_rawData'][0]
            if (name && String(name).toLowerCase().includes(searchTerm)) {
                const isLibrary = sheetTitle === 'GAMES LIBRARY'
                const nameCell = sheet.getCell(row.rowNumber - 1, 0)
                const url = nameCell.hyperlink || null
                matches.push({
                    rowIndex: row.rowNumber - 1,
                    data: isLibrary ? {
                        name: row['_rawData'][0],
                        url,
                        summary: row['_rawData'][1],
                        releaseDate: row['_rawData'][2],
                        seen: row['_rawData'][3],
                        liked: row['_rawData'][4],
                        meh: row['_rawData'][5],
                        disliked: row['_rawData'][6],
                        played: row['_rawData'][7],
                        extras: row['_rawData'][8]
                    } : {
                        name: row['_rawData'][0],
                        url,
                        summary: row['_rawData'][1],
                        releaseDate: row['_rawData'][2],
                        liked: row['_rawData'][3],
                        meh: row['_rawData'][4],
                        disliked: row['_rawData'][5],
                        played: row['_rawData'][6],
                        extras: row['_rawData'][7]
                    }
                })
            }
        })

        return matches
    }

    public async getLatestGameIndex(sheetTitle: string): Promise<number> {
        const sheet = this.sheets.get(sheetTitle)
        if (!sheet) return null

        await this.resetCache(sheet)
        const rows = await sheet.getRows()

        for (let i = rows.length - 1; i >= 0; i--) {
            const name = rows[i]['_rawData'][0]
            if (name) return i
        }

        return null
    }

    public async getGameByRowIndex(sheetTitle: string, rowIndex: number): Promise<{ rowIndex: number, data: any } | null> {
        const sheet = this.sheets.get(sheetTitle)
        if (!sheet) return null

        await this.resetCache(sheet)
        const rows = await sheet.getRows()

        const row = rows[rowIndex]
        if (!row) return null

        const isLibrary = sheetTitle === 'GAMES LIBRARY'
        const nameCell = sheet.getCell(row.rowNumber - 1, 0)
        const url = nameCell.hyperlink || null
        return {
            rowIndex: row.rowNumber - 1,
            data: isLibrary ? {
                name: row['_rawData'][0],
                url,
                summary: row['_rawData'][1],
                releaseDate: row['_rawData'][2],
                seen: row['_rawData'][3],
                liked: row['_rawData'][4],
                meh: row['_rawData'][5],
                disliked: row['_rawData'][6],
                played: row['_rawData'][7],
                extras: row['_rawData'][8]
            } : {
                name: row['_rawData'][0],
                url,
                summary: row['_rawData'][1],
                releaseDate: row['_rawData'][2],
                liked: row['_rawData'][3],
                meh: row['_rawData'][4],
                disliked: row['_rawData'][5],
                played: row['_rawData'][6],
                extras: row['_rawData'][7]
            }
        }
    }

    public async transferGameToArchive(gameData: any, sourceRowIndex: number): Promise<void> {
        return this.client.queue.add(async () => {
            const librarySheet = this.sheets.get('GAMES LIBRARY')
            const archiveSheet = this.sheets.get('GAMES ARCHIVE')

            if (!librarySheet || !archiveSheet) throw new Error('Required sheets not found')

            await this.resetCache(archiveSheet)
            const archiveRows = await archiveSheet.getRows()
            const emptyRowIndex = archiveRows.findIndex(row => !row['_rawData'][0])

            if (emptyRowIndex === -1) throw new Error('Could not find empty row in archive')

            const nextEmptyRow = archiveRows[emptyRowIndex].rowNumber - 1

            const nameCell = archiveSheet.getCell(nextEmptyRow, 0)
            nameCell.formula = `=HYPERLINK("${gameData.url}", "${gameData.name}")`

            const updates = [
                { row: nextEmptyRow, col: 1, value: gameData.summary },
                { row: nextEmptyRow, col: 2, value: gameData.releaseDate },
                { row: nextEmptyRow, col: 3, value: gameData.liked === 'TRUE' },
                { row: nextEmptyRow, col: 4, value: gameData.meh === 'TRUE' },
                { row: nextEmptyRow, col: 5, value: gameData.disliked === 'TRUE' },
                { row: nextEmptyRow, col: 6, value: gameData.played === 'TRUE' },
                { row: nextEmptyRow, col: 7, value: gameData.extras }
            ]

            updates.forEach(update => {
                const cell = archiveSheet.getCell(update.row, update.col)
                cell.value = update.value
            })

            await archiveSheet.saveUpdatedCells()

            await this.resetCache(librarySheet)
            const libraryRows = await librarySheet.getRows()
            const rowToDelete = libraryRows.find(r => r.rowNumber - 1 === sourceRowIndex)

            if (rowToDelete) await rowToDelete.delete()
        })
    }

    public async transferGameToLibrary(gameData: any, sourceRowIndex: number): Promise<void> {
        return this.client.queue.add(async () => {
            const librarySheet = this.sheets.get('GAMES LIBRARY')
            const archiveSheet = this.sheets.get('GAMES ARCHIVE')

            if (!librarySheet || !archiveSheet) throw new Error('Required sheets not found')

            await this.resetCache(librarySheet)
            const libraryRows = await librarySheet.getRows()
            const emptyRowIndex = libraryRows.findIndex(row => !row['_rawData'][0])

            if (emptyRowIndex === -1) throw new Error('Could not find empty row in library')

            const nextEmptyRow = libraryRows[emptyRowIndex].rowNumber - 1

            const nameCell = librarySheet.getCell(nextEmptyRow, 0)
            nameCell.formula = `=HYPERLINK("${gameData.url}", "${gameData.name}")`

            const updates = [
                { row: nextEmptyRow, col: 1, value: gameData.summary },
                { row: nextEmptyRow, col: 2, value: gameData.releaseDate },
                { row: nextEmptyRow, col: 3, value: false },
                { row: nextEmptyRow, col: 4, value: gameData.liked === 'TRUE' },
                { row: nextEmptyRow, col: 5, value: gameData.meh === 'TRUE' },
                { row: nextEmptyRow, col: 6, value: gameData.disliked === 'TRUE' },
                { row: nextEmptyRow, col: 7, value: gameData.played === 'TRUE' },
                { row: nextEmptyRow, col: 8, value: gameData.extras }
            ]

            updates.forEach(update => {
                const cell = librarySheet.getCell(update.row, update.col)
                cell.value = update.value
            })

            await librarySheet.saveUpdatedCells()

            await this.resetCache(archiveSheet)
            const archiveRows = await archiveSheet.getRows()
            const rowToDelete = archiveRows.find(r => r.rowNumber - 1 === sourceRowIndex)

            if (rowToDelete) await rowToDelete.delete()
        })
    }
}