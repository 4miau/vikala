import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

import { Colors } from './Colors'

export function createVideoButton(videoId: string): ActionRowBuilder<ButtonBuilder> {
	const button = new ButtonBuilder()
		.setLabel('Watch on YouTube')
		.setStyle(ButtonStyle.Link)
		.setURL(`https://youtu.be/${videoId}`)

	return new ActionRowBuilder<ButtonBuilder>().addComponents(button)
}

export function parseVideoMessage(message: string, channelName: string, video: YouTubeVideoSnippet): string {
	return message
		.replaceAll('{name}', channelName)
		.replaceAll('{title}', video.title || 'No Title')
		.replaceAll('{link}', `https://youtu.be/${video.resourceId.videoId}`)
}

export function parseVideoEmbed(channel: YouTubeChannel, video: YouTubeVideoSnippet): EmbedBuilder {
	const videoId = video.resourceId.videoId
	const thumbnail = video.thumbnails.maxres?.url ?? video.thumbnails.high?.url ?? video.thumbnails.medium?.url

	return new EmbedBuilder()
		.setAuthor({
			name: channel.name,
			url: `https://youtube.com/@${channel.handle}`,
			iconURL: channel.thumbnailUrl || null
		})
		.setTitle(video.title || 'New Video')
		.setURL(`https://youtu.be/${videoId}`)
		.setColor(Colors.Red)
		.setImage(thumbnail || null)
		.setFooter({ text: 'YouTube' })
		.setTimestamp(new Date(video.publishedAt))
}
