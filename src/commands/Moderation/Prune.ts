import { Args } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { Collection, Message, TextChannel } from 'discord.js'
import * as emoji from 'node-emoji'

@ApplyOptions<Subcommand.Options>({
    name: 'prune',
    aliases: ['purge'],
    description: 'Prune messages in the server.',
    detailedDescription: 'Prune messages in the server based on various filters. Default is 50. You can use options `--amount` (or `--a` for short) ' +
    'to specify the amount of messages to filter through. Will ignore pinned messages.',
    usage: 'prune <all|bots|embeds|files|human|images|links|reactions|user|contains|emoji> [options] [--amount=amount]',
    examples: [
        { 'example': 'prune all 50', 'description': 'Prune the last 50 messages.' },
        { 'example': 'prune bots 100', 'description': 'Prune the last 100 messages sent by bots.' },
        { 'example': 'prune user @User 25', 'description': 'Prune the last 25 messages sent by a specific user.' },
        { 'example': 'prune contains "hello" 30', 'description': 'Prune the last 30 messages that contain the word "hello".' },
        { 'example': 'prune emoji 40', 'description': 'Prune the last 40 messages that contain any emojis/emotes.' }
    ],
    subcommands: [
        { name: 'all', messageRun: 'pruneAllMsg', chatInputRun: 'pruneAllInput', default: true },
        { name: 'bots', messageRun: 'pruneBotsMsg', chatInputRun: 'pruneBotsInput' },
        { name: 'embeds', messageRun: 'pruneEmbedsMsg', chatInputRun: 'pruneEmbedsInput' },
        { name: 'files', messageRun: 'pruneFilesMsg', chatInputRun: 'pruneFilesInput' },
        { name: 'human', messageRun: 'pruneHumanMsg', chatInputRun: 'pruneHumanInput' },
        { name: 'images', messageRun: 'pruneImagesMsg', chatInputRun: 'pruneImagesInput' },
        { name: 'links', messageRun: 'pruneLinksMsg', chatInputRun: 'pruneLinksInput' },
        { name: 'reactions', messageRun: 'pruneReactionsMsg', chatInputRun: 'pruneReactionsInput' },
        { name: 'user', messageRun: 'pruneUserMsg', chatInputRun: 'pruneUserInput' },
        { name: 'contains', messageRun: 'pruneContainsMsg', chatInputRun: 'pruneContainsInput' },
        { name: 'emoji', messageRun: 'pruneEmojiMsg', chatInputRun: 'pruneEmojiInput' }
    ],
    options: ['a', 'amount']
})
export class Prune extends Subcommand {
    client = this.container.client

    public async pruneAllMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages)
        return this.handlePruneResult(deleted, message)
    }

    public async pruneAllInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages) : 0
        return this.handlePruneResult(deleted, interaction)
    }

    public async pruneBotsMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => m.author.bot)
        return this.handlePruneResult(deleted, message, 'bot messages')
    }

    public async pruneBotsInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => m.author.bot) : 0
        return this.handlePruneResult(deleted, interaction, 'bot messages')
    }

    public async pruneEmbedsMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => m.embeds.length > 0)
        return this.handlePruneResult(deleted, message, 'messages with embeds')
    }

    public async pruneEmbedsInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => m.embeds.length > 0) : 0
        return this.handlePruneResult(deleted, interaction, 'messages with embeds')
    }

    public async pruneFilesMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => m.attachments.size > 0)
        return this.handlePruneResult(deleted, message, 'messages with files')
    }

    public async pruneFilesInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => m.attachments.size > 0) : 0
        return this.handlePruneResult(deleted, interaction, 'messages with files')
    }

    public async pruneHumanMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => !m.author.bot)
        return this.handlePruneResult(deleted, message, 'human messages')
    }

    public async pruneHumanInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => !m.author.bot) : 0
        return this.handlePruneResult(deleted, interaction, 'human messages')
    }

    public async pruneImagesMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m =>
            m.attachments.some(att => att.contentType?.startsWith('image/')) ||
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(m.content)
        )
        return this.handlePruneResult(deleted, message, 'messages with images')
    }

    public async pruneImagesInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m =>
            m.attachments.some(att => att.contentType?.startsWith('image/')) ||
            /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(m.content)
        ) : 0
        return this.handlePruneResult(deleted, interaction, 'messages with images')
    }

    public async pruneLinksMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => this.hasValidUrl(m.content))
        return this.handlePruneResult(deleted, message, 'messages with links')
    }

    public async pruneLinksInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => this.hasValidUrl(m.content)) : 0
        return this.handlePruneResult(deleted, interaction, 'messages with links')
    }

    public async pruneReactionsMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => m.reactions.cache.size > 0)
        return this.handlePruneResult(deleted, message, 'messages with reactions')
    }

    public async pruneReactionsInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => m.reactions.cache.size > 0) : 0
        return this.handlePruneResult(deleted, interaction, 'messages with reactions')
    }

    public async pruneUserMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const user = await args.pick('user').catch(() => null)
        if (!user) return message.channel.send({ content: 'Please provide a valid user to prune messages from.' })

        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => m.author.id === user.id)
        return this.handlePruneResult(deleted, message, `messages from ${user.tag}`)
    }

    public async pruneUserInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const user = interaction.options.getUser('user', true)
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => m.author.id === user.id) : 0
        return this.handlePruneResult(deleted, interaction, `messages from ${user.tag}`)
    }

    public async pruneContainsMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return
        const text = await args.restResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!text) return message.channel.send({ content: 'Please provide text to search for in messages.' })

        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => m.content.toLowerCase().includes(text.toLowerCase()))
        return this.handlePruneResult(deleted, message, `messages containing "${text}"`)
    }

    public async pruneContainsInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const text = interaction.options.getString('text')
        if (!text) return interaction.reply({ content: 'Please provide text to search for in messages.', flags: ['Ephemeral'] })

        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => m.content.toLowerCase().includes(text.toLowerCase())) : 0
        return this.handlePruneResult(deleted, interaction, `messages containing "${text}"`)
    }

    public async pruneEmojiMsg(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const amount = args.getOptionResult('amount', 'a').map(val => parseInt(val)).unwrapOrElse(() => 50)
        const messages = await message.channel.messages.fetch({ limit: amount })
        const deleted = await this.executeMessagePrune(messages, m => {
            const hasCustomEmoji = /<a?:[a-zA-Z0-9_]+:[0-9]+>/g.test(m.content)

            const unemojified = emoji.unemojify(m.cleanContent)
            const emojiMatches = unemojified.match(/:([a-zA-Z0-9_+-]+):/g) || []
            const hasUnicodeEmoji = emojiMatches.some(emojiName => emoji?.has(emojiName))

            return hasCustomEmoji || hasUnicodeEmoji
        })
        return this.handlePruneResult(deleted, message, 'messages with emoji')
    }

    public async pruneEmojiInput(interaction: Subcommand.ChatInputCommandInteraction) {
        const amount = interaction.options.getInteger('amount') ?? 50
        const messages = await interaction.channel?.messages.fetch({ limit: amount })
        const deleted = messages ? await this.executeMessagePrune(messages, m => {
            const hasCustomEmoji = /<a?:[a-zA-Z0-9_]+:[0-9]+>/g.test(m.content)

            const unemojified = emoji.unemojify(m.content)
            const emojiMatches = unemojified.match(/:([a-zA-Z0-9_+-]+):/g) || []
            const hasUnicodeEmoji = emojiMatches.some(emojiName => emoji?.has(emojiName))

            return hasCustomEmoji || hasUnicodeEmoji
        }) : 0

        return this.handlePruneResult(deleted, interaction, 'messages with emoji')
    }

    private async executeMessagePrune(messages: Collection<string, Message>, filterFn?: (m: Message) => boolean) {
        const unpinnedMessages = messages.filter((m: any) => !m.pinned)
        const filtered = filterFn ? unpinnedMessages.filter(filterFn) : unpinnedMessages

        for (const m of filtered.values()) { await m?.delete() }
        return filtered.size
    }

    private async handlePruneResult(deleted: number, context: Message | Subcommand.ChatInputCommandInteraction, messageType = 'messages') {
        if (deleted === 0) {
            const errorMsg = 'No messages deleted, make sure the messages aren\'t over 2 weeks old.'
            if (context instanceof Message) {
                return context.channel.isSendable() ? context.channel.send({ content: errorMsg }) : null
            }
            return context.reply({ content: errorMsg, flags: ['Ephemeral'] })
        }

        const successMsg = `🧹 Deleted ${deleted} ${messageType}.`
        if (context instanceof Message) {
            return context.channel.isSendable() ? context.channel.send({ content: successMsg })
                .then((m: Message) => setTimeout(() => m?.delete(), 5000)) : null
        }
        return context.reply({ content: successMsg, flags: ['Ephemeral'] })
    }

    private hasValidUrl(text: string): boolean {
        const words = text.split(/\s+/)
        return words.some(word => {
            const cleanWord = word.replace(/^[^\w]+|[^\w]+$/g, '')

            try {
                const url = new URL(cleanWord)
                return url.protocol === 'http:' || url.protocol === 'https:'
            } catch {
                if (/\w+\.\w{2,}/.test(cleanWord)) {
                    try {
                        const url = new URL(`http://${cleanWord}`)
                        return url.protocol === 'http:'
                    } catch {
                        return false
                    }
                }
                return false
            }
        })
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('prune')
                .setDescription('Prune messages in the server.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('all')
                        .setDescription('Prune all messages.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('bots')
                        .setDescription('Prune messages sent by bots.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('embeds')
                        .setDescription('Prune messages with embeds.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('files')
                        .setDescription('Prune messages with file attachments.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('human')
                        .setDescription('Prune messages sent by humans.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('images')
                        .setDescription('Prune messages with images.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('links')
                        .setDescription('Prune messages with links.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('reactions')
                        .setDescription('Prune messages with reactions.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('user')
                        .setDescription('Prune messages from a specific user.')
                        .addUserOption(option =>
                            option
                                .setName('user')
                                .setDescription('The user to prune messages from.')
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('contains')
                        .setDescription('Prune messages containing specific text.')
                        .addStringOption(option =>
                            option
                                .setName('text')
                                .setDescription('The text to search for in messages.')
                                .setRequired(true)
                        )
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('emoji')
                        .setDescription('Prune messages with emoji.')
                        .addIntegerOption(option =>
                            option
                                .setName('amount')
                                .setDescription('The number of messages to prune (default 50).')
                                .setRequired(false)
                        )
                )
        )
    }
}