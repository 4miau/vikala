declare namespace VHS {
	export const LIBRARY_COLUMNS = {
		NAME: 0,
		SUMMARY: 1,
		RELEASE_DATE: 2,
		SEEN: 3,
		LIKED: 4,
		MEH: 5,
		DISLIKED: 6,
		PLAYED: 7,
		EXTRAS: 8
	} as const

	export const ARCHIVE_COLUMNS = {
		NAME: 0,
		SUMMARY: 1,
		RELEASE_DATE: 2,
		LIKED: 3,
		MEH: 4,
		DISLIKED: 5,
		PLAYED: 6,
		REPLAYED: 7,
		EXTRAS: 8
	} as const

	export interface LibraryGameEntry {
		name: string
		url: string | null
		summary: string
		releaseDate: string
		seen: boolean
		liked: boolean
		meh: boolean
		disliked: boolean
		played: boolean
		extras: string
	}

	export interface ArchiveGameEntry {
		name: string
		url: string | null
		summary: string
		releaseDate: string
		liked: boolean
		meh: boolean
		disliked: boolean
		played: boolean
		replayed: boolean
		extras: string
	}

	export interface GameSearchResult {
		rowIndex: number
		data: LibraryGameEntry | ArchiveGameEntry
	}
}
