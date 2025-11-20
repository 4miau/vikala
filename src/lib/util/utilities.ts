import { Message, SendableChannels } from 'discord.js'
import ms from 'ms'

export function yes(content: string) {
    if (content && (/^y(?:e(?:a|s)?)?$/i).test(content.trim())) return true
    return false
}

declare type Options = {
    num?: number
    userId?: string
    deleteAfter?: boolean
    reqMsg?: Message
    timeout?: number
}

export async function getInput(chnl: SendableChannels, options: Options): Promise<string[]> {
    const filter = options.userId ? (m: Message) => m.author.id === options.userId && m.channel.id === chnl.id : (m: Message) => m.channel.id === chnl.id

    try {
        const collected = await chnl.awaitMessages({ filter, max: options.num || 1, time: options.timeout || ms('30s') })

        if (options.deleteAfter) {
            collected.forEach((m) => { chnl.messages.cache.delete(m.id) })
            if (options.reqMsg) options.reqMsg.delete().catch(null)
        }

        return collected.map((m) => m.content)
    } catch {
        return []
    }
}

export async function timerMessage(m: Message, delay: number = ms('5s')) {
    return new Promise(resolve => setTimeout(resolve, delay))
        .then(() => m?.delete() )
}