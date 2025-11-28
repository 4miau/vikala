import { Message, SendableChannels } from 'discord.js'
import ms from 'ms'
import * as cheerio from 'cheerio'

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

export async function fetchItchioDescription(data: string): Promise<string> {
    try {
        const $ = cheerio.load(data)

        const description =
            $('meta[name="description"]').attr('content') ||
            $('meta[property="og:description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') ||
            $('.game_description').first().text().trim() ||
            $('.formatted_description').first().text().trim() ||
            $('.game_frame .game_info_panel_widget p').first().text().trim() ||
            $('.itch_game_content p').first().text().trim() ||
            'Indie game available on itch.io'

        const cleaned = description.replace(/\s+/g, ' ').trim()
        return cleaned.length > 200 ? cleaned.substring(0, 197) + '...' : cleaned
    } catch {
        return 'Indie game available on itch.io'
    }
}