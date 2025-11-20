import { Role } from 'discord.js'

declare type TwitchUser = {
    broadcaster_language: string
    broadcaster_login: string
    display_name: string
    game_id: string
    game_name: string
    id: string
    is_live: boolean
    tag_ids: string[]
    tags: string[]
    thumbnail_url: string
    title: string
    started_at: string
}

declare type TwitchStream = {
    id: string
    user_id: string
    user_login: string
    user_name: string
    game_id: string
    game_name: string
    type: string
    title: string
    viewer_count: number
    started_at: string
    language: string
    thumbnail_url: string
    tag_ids: string[]
    tags: string[]
    is_mature: boolean
}

declare type TwitchVOD = {
    id: string
    stream_id: string
    user_id: string
    user_login: string
    user_name: string
    title: string
    description: string
    created_at: string
    published_at: string
    url: string
    thumbnail_url: string
    viewable: string
    view_count: number
    language: string
    type: string
    duration: string
    muted_segments: any[]
}

declare type TwitchGame = {
    id: string
    name: string
    box_art_url: string
    igdb_id: string
}

declare type Streamer = {
    id: string
    name: string
    message: string
    channel: string
    embed: boolean
    posted: boolean
    postedMessageId: string
    lastPosted: number
    stream: TwitchStream
    lastStreamThumbnail?: string
}