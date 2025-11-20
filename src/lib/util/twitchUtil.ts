import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'

import { Streamer, TwitchStream, TwitchVOD, TwitchGame } from '../../typings/@definitions/Twitch'

const DEFAULT_GAME_ICON = 'https://static-cdn.jtvnw.net/ttv-boxart/0_IGDB-40x53.jpg'
const DEFAULT_OFFLINE_IMAGE = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-1920x1080.jpg'

export function getGameIconUrl(game: TwitchGame): string {
    if (!game) return DEFAULT_GAME_ICON
    return game.box_art_url.replace('{width}', '40').replace('{height}', '53')
}

export function createStreamButton(stream: TwitchStream): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
        .setLabel('Watch Stream')
        .setStyle(ButtonStyle.Link)
        .setURL(`https://twitch.tv/${stream.user_login}`)

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button)
}

export function createVODButton(vod: TwitchVOD): ActionRowBuilder<ButtonBuilder> {
    const button = new ButtonBuilder()
        .setLabel('Watch VOD')
        .setStyle(ButtonStyle.Link)
        .setURL(vod.url)

    return new ActionRowBuilder<ButtonBuilder>().addComponents(button)
}

export function parseStreamMessage(message: string, stream: TwitchStream): string {
    return message
        .replaceAll('{name}', stream.user_login)
        .replaceAll('{title}', stream?.title || 'No Title')
        .replaceAll('{game}', stream?.game_name || 'Unknown')
        .replaceAll('{link}', `https://twitch.tv/${stream.user_login}`)
}

export function parseOnlineEmbed(stream: TwitchStream, game?: TwitchGame): EmbedBuilder {
    return new EmbedBuilder()
        .setAuthor({
            name: stream.user_login,
            iconURL: getGameIconUrl(game)
        })
        .setTitle(stream?.title || 'No Title')
        .setColor(5793266)
        .setImage(stream.thumbnail_url.replace('{width}', '1920').replace('{height}', '1080'))
        .addFields(
            { name: 'Game', value: stream?.game_name || 'Unknown', inline: true },
            { name: 'Views', value: stream?.viewer_count.toString() || '0', inline: true }
        )
        .setFooter({ text: `Started streaming • ${new Date(stream.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` })
}

export function parseOfflineEmbed(streamer: Streamer, vod: TwitchVOD, game?: TwitchGame): EmbedBuilder {
    const offlineImage = streamer.lastStreamThumbnail || DEFAULT_OFFLINE_IMAGE

    return new EmbedBuilder()
        .setAuthor({
            name: vod.user_login,
            iconURL: getGameIconUrl(game)
        })
        .setTitle(vod?.title || 'No Title')
        .setColor(5793266)
        .setImage(offlineImage)
        .addFields(
            { name: 'Game', value: streamer.stream?.game_name || 'Unknown', inline: true },
            { name: 'Views', value: vod.view_count.toString(), inline: true },
            { name: 'Duration', value: vod.duration, inline: true }
        )
        .setFooter({ text: `Last Online • ${new Date(streamer.lastPosted).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` })
}