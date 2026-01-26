declare type ItchioGame = {
	authors: ItchioGameAuthor[]
	id: number
	title: string
	cover_image: string
	tags: string[]
	sale?: ItchioGameSale
	links: ItchioGameLinks
	price: string
	original_price: string
}

declare type ItchioGameAuthor = {
	name: string
	url: string
}

declare type ItchioGameSale = {
	title: string
	rate: number
	end_date: string
	id: number
}

declare type ItchioGameLinks = {
	self: string
	devlog: string
	comments: string
}
