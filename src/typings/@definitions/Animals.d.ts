declare type CatApiResponse = {
	id: string
	url: string
	width: number
	height: number
}

declare type DogApiResponse = {
	message: string
	status: string
}

declare type BunnyApiResponse = {
	media: {
		gif: string
		poster: string
	}
	thisServed: number
}

declare type FoxApiResponse = {
	image: string
	link: string
}
