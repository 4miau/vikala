import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet, GoogleSpreadsheetRow } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { Message } from 'discord.js'
import * as cheerio from 'cheerio'

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

		if (message.content.includes('steampowered') || message.content.includes('itch.io') || message.content.includes('gog.com')) {
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
		return rows.findIndex((row) => row.rowNumber > 1 && !row['_rawData'][0] && !row['_rawData'][1]) + 2
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
			else if (gameLink.includes('gog.com')) await this.addGogEntry(gameLink, sheetIndex)
		})
	}

	private async addSteamEntry(gameLink: string, sheetIndex: number) {
		const librarySheet = this.sheets.get('GAMES LIBRARY')
		if (!librarySheet) return

		const gameId = gameLink.split('/').find((part) => /^\d+$/.test(part))
		const game: SteamGame = await this.client.tasks.get('getsteamgame').exec(gameId)

		const updates = [
			{ row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink.replace(/"/g, '""')}", "${game.name.replace(/"/g, '""')}")` },
			{ row: sheetIndex, col: 1, value: game.short_description },
			{ row: sheetIndex, col: 2, value: game.release_date.date?.replace(',', '') },
			{ row: sheetIndex, col: 8, value: `From Steam, price: ${game.is_free ? 'Free to Play' : game.price_overview?.final_formatted || 'N/A'}` }
		]

		updates.forEach((update) => {
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
			{ row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink.replace(/"/g, '""')}", "${game.title.replace(/"/g, '""')}")` },
			{ row: sheetIndex, col: 1, value: description },
			{ row: sheetIndex, col: 8, value: `From itch.io, price: ${game.price}` }
		]

		updates.forEach((update) => {
			const cell = librarySheet.getCell(update.row, update.col)
			if (update.formula) cell.formula = update.formula
			else cell.value = update.value
		})

		await librarySheet.saveUpdatedCells()
	}

	private async addGogEntry(gameLink: string, sheetIndex: number) {
		const librarySheet = this.sheets.get('GAMES LIBRARY')
		if (!librarySheet) return

		const slug = gameLink.match(/\/game\/([^/?#]+)/)?.[1]
		if (!slug) return

		const searchQuery = slug.replace(/_/g, ' ')
		const searchResult: GOGCatalogSearchResult = await this.client.tasks.get('getgoggame').exec(searchQuery)

		if (!searchResult.products || searchResult.products.length === 0) return

		const bestMatch = searchResult.products.find((p) => p.slug === slug) || searchResult.products[0]
		const game: GOGGame = await this.client.tasks.get('getgoggamedetails').exec(bestMatch.id)

		let description = ''
		if (typeof game.description === 'string') {
			description = game.description.replace(/<[^>]*>/g, '').substring(0, 500)
		} else if (game.description && typeof game.description === 'object') {
			const htmlContent = game.description.full || game.description.lead || ''
			const $ = cheerio.load(htmlContent)
			const textContent = $('body').text().replace(/\s+/g, ' ').trim()
			const sentences = textContent.split(/[.!?]\s+/)

			description = sentences.slice(0, 3).join('. ').substring(0, 500)
		}

		const releaseDate = game.release_date
			? new Date(game.release_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
			: ''

		const updates = [
			{ row: sheetIndex, col: 0, formula: `=HYPERLINK("${gameLink.replace(/"/g, '""')}", "${game.title.replace(/"/g, '""')}")` },
			{ row: sheetIndex, col: 1, value: description },
			{ row: sheetIndex, col: 2, value: releaseDate },
			{ row: sheetIndex, col: 8, value: `From GOG, price: ${searchResult.products[0].price.final}` }
		]

		updates.forEach((update) => {
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

	private mapRowToGameData(
		row: GoogleSpreadsheetRow,
		sheet: GoogleSpreadsheetWorksheet,
		sheetTitle: string
	): VHS.LibraryGameEntry | VHS.ArchiveGameEntry {
		const isLibrary = sheetTitle === 'GAMES LIBRARY'
		const nameCell = sheet.getCell(row.rowNumber - 1, 0)
		const url = nameCell.hyperlink || null

		if (isLibrary) {
			return {
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
			}
		} else {
			return {
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

	public async findGamesByName(sheetTitle: string, gameName: string): Promise<VHS.GameSearchResult[]> {
		const sheet = this.sheets.get(sheetTitle)
		if (!sheet) return []

		await this.resetCache(sheet)
		const rows = await sheet.getRows()

		const matches: VHS.GameSearchResult[] = []
		const searchTerm = gameName.toLowerCase()

		rows.forEach((row) => {
			const name = row.get('Name') || row['_rawData'][0]
			if (name && String(name).toLowerCase().includes(searchTerm)) {
				matches.push({
					rowIndex: row.rowNumber - 1,
					data: this.mapRowToGameData(row, sheet, sheetTitle)
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

	public async getGameByRowIndex(sheetTitle: string, rowIndex: number): Promise<VHS.GameSearchResult> {
		const sheet = this.sheets.get(sheetTitle)
		if (!sheet) return null

		await this.resetCache(sheet)
		const rows = await sheet.getRows()

		const row = rows[rowIndex]
		if (!row) return null

		return {
			rowIndex: row.rowNumber - 1,
			data: this.mapRowToGameData(row, sheet, sheetTitle)
		}
	}

	private writeGameToLibraryRow(sheet: GoogleSpreadsheetWorksheet, rowIndex: number, gameData: any) {
		const nameCell = sheet.getCell(rowIndex, 0)
		nameCell.formula = `=HYPERLINK("${gameData.url?.replace(/"/g, '""')}", "${gameData.name?.replace(/"/g, '""')}")`

		const updates = [
			{ row: rowIndex, col: 1, value: gameData.summary },
			{ row: rowIndex, col: 2, value: gameData.releaseDate },
			{ row: rowIndex, col: 3, value: gameData.seen === 'TRUE' },
			{ row: rowIndex, col: 4, value: gameData.liked === 'TRUE' },
			{ row: rowIndex, col: 5, value: gameData.meh === 'TRUE' },
			{ row: rowIndex, col: 6, value: gameData.disliked === 'TRUE' },
			{ row: rowIndex, col: 7, value: gameData.played === 'TRUE' },
			{ row: rowIndex, col: 8, value: gameData.extras }
		]

		updates.forEach((update) => {
			const cell = sheet.getCell(update.row, update.col)
			cell.value = update.value
		})
	}

	private writeGameToArchiveRow(sheet: GoogleSpreadsheetWorksheet, rowIndex: number, gameData: any) {
		const nameCell = sheet.getCell(rowIndex, 0)
		nameCell.formula = `=HYPERLINK("${gameData.url?.replace(/"/g, '""')}", "${gameData.name?.replace(/"/g, '""')}")`

		const updates = [
			{ row: rowIndex, col: 1, value: gameData.summary },
			{ row: rowIndex, col: 2, value: gameData.releaseDate },
			{ row: rowIndex, col: 3, value: gameData.liked === 'TRUE' },
			{ row: rowIndex, col: 4, value: gameData.meh === 'TRUE' },
			{ row: rowIndex, col: 5, value: gameData.disliked === 'TRUE' },
			{ row: rowIndex, col: 6, value: gameData.played === 'TRUE' },
			{ row: rowIndex, col: 7, value: gameData.extras }
		]

		updates.forEach((update) => {
			const cell = sheet.getCell(update.row, update.col)
			cell.value = update.value
		})
	}

	public async transferGameToArchive(gameData: any, sourceRowIndex: number): Promise<void> {
		return this.client.queue.add(async () => {
			const librarySheet = this.sheets.get('GAMES LIBRARY')
			const archiveSheet = this.sheets.get('GAMES ARCHIVE')

			if (!librarySheet || !archiveSheet) throw new Error('Required sheets not found')

			await this.resetCache(archiveSheet)
			const archiveRows = await archiveSheet.getRows()
			const emptyRowIndex = archiveRows.findIndex((row) => !row['_rawData'][0])

			if (emptyRowIndex === -1) throw new Error('Could not find empty row in archive')

			const nextEmptyRow = archiveRows[emptyRowIndex].rowNumber - 1

			this.writeGameToArchiveRow(archiveSheet, nextEmptyRow, gameData)
			await archiveSheet.saveUpdatedCells()

			await this.resetCache(librarySheet)
			const libraryRows = await librarySheet.getRows()
			const rowToDelete = libraryRows.find((r) => r.rowNumber - 1 === sourceRowIndex)

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
			const emptyRowIndex = libraryRows.findIndex((row) => !row['_rawData'][0])

			if (emptyRowIndex === -1) throw new Error('Could not find empty row in library')

			const nextEmptyRow = libraryRows[emptyRowIndex].rowNumber - 1

			this.writeGameToLibraryRow(librarySheet, nextEmptyRow, gameData)
			await librarySheet.saveUpdatedCells()

			await this.resetCache(archiveSheet)
			const archiveRows = await archiveSheet.getRows()
			const rowToDelete = archiveRows.find((r) => r.rowNumber - 1 === sourceRowIndex)

			if (rowToDelete) await rowToDelete.delete()
		})
	}
}
