// 8BALL
export const eightBallReplies: string[] = [
    'Yes', 'No', 'Maybe', 'Probably', 'Probably not', 'It is certain, yes', 'I can tell you certainly, no', 'Without a doubt, yes', 'Definitely', 'Definitely not',
    'Ask again later', 'Try again later', 'It is likely', 'It is unlikely', 'Fortunately, yes', 'Unfortunately, no', 'I have decided it is so', 'I have decided it is not',
    'Without a doubt', 'I am uncertain', 'I can not be sure about that', 'If charlie says so, yes'
]

// ANIME
export const animeQuotesApi: string = 'https://yurippe.vercel.app/api/quotes'

// ANIMALS
export const catApi: string = 'https://api.thecatapi.com/v1/images/search'
export const dogApi: string = 'https://dog.ceo/api/breeds/image/random'
export const bunnyApi: string = 'https://api.bunnies.io/v2/loop/random/?media=gif'
export const foxApi: string = 'https://randomfox.ca/floof/'

// AUTOMOD
export const AUTOMOD_RULE_TYPES = ['spam', 'caps', 'invites', 'bad_words', 'attachment_spam']
export const AUTOMOD_PUNISHMENTS = ['warn', 'mute', 'temp_mute', 'kick', 'ban', 'temp_ban']

export const AUTOMOD_RULE_NAMES: Record<string, string> = {
    'spam': 'Spam',
    'caps': 'Excessive Caps',
    'invites': 'Discord Invites',
    'bad_words': 'Bad Words',
    'attachment_spam': 'Attachment Spam'
}

export const AUTOMOD_RULE_DESCRIPTIONS: Record<string, string> = {
    'spam': 'Detects users sending multiple messages in quick succession.',
    'caps': 'Detects messages with excessive capital letters above the threshold.',
    'invites': 'Blocks Discord server invite links in messages.',
    'bad_words': 'Filters messages containing blacklisted words or phrases.',
    'attachment_spam': 'Detects users sending too many attachments rapidly.'
}

export const AUTOMOD_REGEX = {
    DISCORD_INVITE: /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/([a-zA-Z0-9]+)/gi,
    NON_LETTERS: /[^a-zA-Z]/g,
    UPPERCASE_LETTERS: /[A-Z]/g
} as const

// GAMES
export const steamApi: string = 'https://store.steampowered.com/api/appdetails?appids='
export const ggDealsApi: string = 'http://api.gg.deals/v1/prices/by-steam-app-id/'
export const rawgApi: string = 'https://api.rawg.io/api'

// GOOGLE API
export const googleScopes: string[] = ['https://www.googleapis.com/auth/spreadsheets']

// IMAGES
export const danbooruApi: string = 'https://danbooru.donmai.us/'

// TWITCH
export const twitchApi: string = 'https://id.twitch.tv/oauth2'
export const twitchApi2: string = 'https://api.twitch.tv/helix'

export const defaultStreamMessage: string = '{name} has gone live! {link}'