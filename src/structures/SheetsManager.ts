import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { Message } from 'discord.js'


import Vikala from '../client/vikala'
import creds from '../keys/tien-476418-7db3e64f7a21.json'
import { googleScopes } from '../lib/util/constants'


export default class Sheets {
    protected client: Vikala
    jwt: JWT
    doc: GoogleSpreadsheet
    vhsSheet: GoogleSpreadsheetWorksheet
    private lastCacheReset: number = 0
    private readonly CACHE_RESET_COOLDOWN = 2000

    constructor(cli: Vikala) {
        this.client = cli
    }

    public async _init() {
        this.jwt = new JWT({ key: creds.private_key, email: creds.client_email, scopes: googleScopes })

        this.doc = new GoogleSpreadsheet('1s0KxBSVMbH1ot-hUBQQbQGhogXf9hON6fQr6IDbrOgM', this.jwt)
        await this.doc.loadInfo(true)

        this.vhsSheet = this.doc.sheetsByTitle['GAMES LIBRARY']
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
        if (!this.vhsSheet) return -1

        const now = Date.now()
        if (now - this.lastCacheReset > this.CACHE_RESET_COOLDOWN) {
            await this.resetCache(this.vhsSheet)
            this.lastCacheReset = now
        }

        const rows = await this.vhsSheet.getRows({ offset: 1 })
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
        const gameId = gameLink.split('/').find(part => /^\d+$/.test(part))
        const game: SteamGame = await this.client.tasks.get('getsteamgame').exec(gameId)

        const updates = [
            { row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink}", "${game.name}")` },
            { row: sheetIndex, col: 1, value: game.short_description },
            { row: sheetIndex, col: 2, value: game.release_date.date?.replace(',', '') },
            { row: sheetIndex, col: 8, value: `From Steam, price: ${game.is_free ? 'Free to Play' : game.price_overview?.final_formatted || 'N/A'}` }
        ]

        this.applyCellUpdates(updates)
        await this.vhsSheet.saveUpdatedCells()
    }

    private async addItchEntry(gameLink: string, sheetIndex: number) {
        const game: ItchioGame = await this.client.tasks.get('getitchiogame').exec(gameLink)

        const updates = [
            { row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink}", "${game.title}")` },
            { row: sheetIndex, col: 1, value: game.links.self },
            { row: sheetIndex, col: 8, value: `From itch.io, price: ${game.price}` }
        ]

        this.applyCellUpdates(updates)
        await this.vhsSheet.saveUpdatedCells()
    }

    private applyCellUpdates(updates: Array<{ row: number, col: number, value?: any, formula?: string }>) {
        updates.forEach(update => {
            const cell = this.vhsSheet.getCell(update.row, update.col)
            if (update.formula) cell.formula = update.formula
            else cell.value = update.value
        })
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
}