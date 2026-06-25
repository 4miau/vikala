declare type YouTubeChannelInfo = {
	id: string
	snippet: {
		title: string
		description: string
		customUrl: string
		publishedAt: string
		thumbnails: {
			default: { url: string }
			medium: { url: string }
			high: { url: string }
		}
	}
	contentDetails: {
		relatedPlaylists: {
			uploads: string
		}
	}
}

declare type YouTubeVideoSnippet = {
	publishedAt: string
	channelId: string
	title: string
	description: string
	thumbnails: {
		default: { url: string }
		medium: { url: string; width: number; height: number }
		high: { url: string; width: number; height: number }
		maxres?: { url: string; width: number; height: number }
	}
	resourceId: {
		kind: string
		videoId: string
	}
	channelTitle: string
}

declare type YouTubeChannel = {
	id: string
	handle: string
	name: string
	thumbnailUrl: string
	uploadsPlaylistId: string
	message: string
	channel: string
	guildId: string
	embed: boolean
	lastVideoId: string | null
	lastPosted: number | null
}
