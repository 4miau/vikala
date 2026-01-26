declare type RawgGame = {
	id: number
	slug: string
	name: string
	name_original: string
	description: string
	metacritic: number
	metacritic_platforms: RawgGameMetacriticPlatform[]
	released: string
	tba: boolean
	updated: string
	background_image: string
	background_image_additional: string
	website: string
	rating: number
	rating_top: number
	ratings: RawgGameRatings[]
	reactions: RawgGameReactions
	added: number
	added_by_status: RawgGameStatus
	playtime: number
	screenshots_count: number
	movies_count: number
	creators_count: number
	achievements_count: number
	parent_achievements_count: number
	reddit_url: string
	reddit_name: string
	reddit_description: string
	reddit_logo: string
	reddit_count: number
	twitch_count: number
	youtube_count: number
	reviews_text_count: number
	ratings_count: number
	suggestions_count: number
	alternative_names: string[]
	metacritic_url: string
	parents_count: number
	additions_count: number
	game_series_count: number
	user_game: null
	reviews_count: number
	saturated_color: string
	dominant_color: string
	parent_platforms: RawgGameParentPlatforms[]
	platforms: RawgGamePlatforms[]
	stores: RawgGameStoresExpanded[]
	developers: RawgGameDeveloper[]
	genres: RawgGameGenresExpanded[]
	tags: RawgGameTags[]
	publishers: RawgGamePublisher[]
	esrb_rating: RawgGameESRBRating
	clip: null
	description_raw: string
}

export type RawgGameDeveloper = {
	id: number
	name: string
	slug: string
	games_count: number
	image_background: string
}

export type RawgGameGenresExpanded = {
	id: number
	name: string
	slug: string
	games_count: number
	image_background: string
}

export type RawgGamePublisher = {
	id: number
	name: string
	slug: string
	games_count: number
	image_background: string
}

declare type RawgGameResult = {
	slug: string
	name: string
	playtime: number
	platforms: RawgGamePlatforms[]
	stores: RawgGameStores[]
	released: string
	tba: boolean
	background_image: string
	rating: number
	rating_top: number
	ratings: RawgGameRatings[]
	ratings_count: number
	reviews_text_count: number
	added: number
	added_by_status: RawgGameStatus
	metacritic: number
	suggestions_count: number
	updated: string
	id: number
	score: string
	clip: null
	tags: RawgGameTags[]
	esrb_rating: RawgGameESRBRating
	user_game: null
	reviews_count: number
	community_rating: number
	saturated_color: string
	dominant_color: string
	short_screenshots: RawgGameShortScreenshots[]
	parent_platforms: RawgGameParentPlatforms[]
	genres: RawgGameGenres[]
}

declare type RawgGameMetacriticPlatform = {
	metascore: number
	url: string
	platform: RawgGameMetacriticPlatformEntry
}

export type RawgGameMetacriticPlatformEntry = {
	platform: number
	name: string
	slug: string
}

export type RawgGameParentPlatforms = RawgGamePlatformsResult

export type RawgGamePlatformsResult = { platform: RawgGamePlatformEntry }

export type RawgGamePlatformEntry = {
	id: number
	name: string
	slug: string
}

export type RawgGamePlatforms = { platform: RawgGamePlatform }

export type RawgGamePlatform = {
	id: number
	name: string
	slug: string
	image: string
	year_end: number
	year_start: number
	games_count: number
	image_background: string
}

export type RawgGameReactions = {
	[key: string]: number
}

export type RawgGameStoresExpanded = { store: RawgGameStoreExpandedEntry }

export type RawgGameStoreExpandedEntry = {
	id: number
	name: string
	slug: string
	domain: string
	games_count: number
	image_background: string
}

export type RawgGameStores = RawgGameStoreEntry[]

export type RawgGameStoreEntry = { store: RawgGameStoreResult }

export type RawgGameStoreResult = {
	id: number
	name: string
	slug: string
}

export type RawgGameRatings = {
	id: number
	title: string
	count: number
	percent: number
}

export type RawgGameShortScreenshots = {
	id: number
	image: string
}

export type RawgGameGenres = {
	id: number
	name: string
	slug: string
}

export type RawgGameTags = {
	id: number
	name: string
	slug: string
	language: string
	games_count: number
	image_background: string
}

export type RawgGameESRBRating = {
	id: number
	name: string
	slug: string
	name_en: string
	name_ru: string
}

declare type RawgGameStatus = {
	yet: number
	owned: number
	beaten: number
	toplay: number
	dropped: number
	playing: number
}
