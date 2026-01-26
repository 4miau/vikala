declare type GGDealsGameResponse = {
	title: string
	url: string
	prices: GGDealsGamePrices
}

declare type GGDealsGamePrices = {
	currentRetail: string
	currentKeyshops: string
	historicalRetail: string
	historicalKeyshops: string
	currency: string
}
