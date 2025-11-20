import { TextChannel, ThreadChannel, NewsChannel } from 'discord.js'


declare type SendableChannel = TextChannel | ThreadChannel | NewsChannel & { isSendable: () => boolean }

declare type LogType = 'channel' | 'message' | 'guild' | 'moderation' | 'role' | 'user' | 'all'

declare type ActivityType = 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING'

export type ActivityStatus = 'online' | 'idle' | 'dnd' | 'invisible'