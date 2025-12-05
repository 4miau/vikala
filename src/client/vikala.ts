import { ArgumentStore, BucketScope, CommandStore, InteractionHandlerStore, ListenerStore, LogLevel, PreconditionStore, SapphireClient } from '@sapphire/framework'
import { BitFieldResolvable, IntentsBitField, Message, Options, Partials } from 'discord.js'
import '@sapphire/plugin-subcommands/register'
import path from 'path'
import mongoose from 'mongoose'
import ms from 'ms'

import APIManager from '../structures/APIManager'
import Queue from '../structures/Queue'
import SettingsProvider from '../structures/SettingsProvider'
import Components from './configs'
import { envs } from '../lib/util/environmentVariables'
import TwitchManager from '../structures/TwitchManager'
import Sheets from '../structures/SheetsManager'
import Router from '../router/Router'
import { TaskStore } from '../stores/TaskStore'
import ModLogger from '../structures/ModLogger'
import EventLogger from '../structures/EventLogger'
import PresenceManager from '../structures/PresenceManager'
import LevelingManager from '../structures/LevelingManager'
import WelcomeManager from '../structures/WelcomeManager'
import AutoroleManager from '../structures/AutoroleManager'
import AutomodManager from '../structures/AutomodManager'
import RoleGroupManager from '../structures/RoleGroupManager'
import HotReloadWatcher from '../structures/HotReloadWatcher'
import HotReloadManager from '../structures/HotReloadManager'

declare module '@sapphire/framework' {
    interface SapphireClient {
        owner: string
        commandStore: CommandStore
        listenerStore: ListenerStore
        preconditions: PreconditionStore
        arguments: ArgumentStore
        interactionHandlerStore: InteractionHandlerStore
        settings: SettingsProvider

        cases: ModLogger
        presences: PresenceManager
        leveling: LevelingManager
        welcome: WelcomeManager
        autoroles: AutoroleManager
        automod: AutomodManager
        roleGroups: RoleGroupManager
        events: EventLogger
        tasks: TaskStore
        router: Router
        sheets: Sheets
        twitch: TwitchManager
        api: APIManager
        queue: Queue
        hotReloadWatcher: HotReloadWatcher
        hotReloadManager: HotReloadManager
    }
}

interface BotOptions {
    owner?: string
    defaultPrefix?: string
    token: string
    intents?: number | BitFieldResolvable<any, any>
}

export default class Vikala extends SapphireClient {
    commandStore: CommandStore
    listenerStore: ListenerStore
    interactionHandlerStore: InteractionHandlerStore
    preconditions: PreconditionStore
    arguments: ArgumentStore
    settings: SettingsProvider

    cases: ModLogger
    events: EventLogger
    tasks: TaskStore
    router: Router
    sheets: Sheets
    presences: PresenceManager
    leveling: LevelingManager
    welcome: WelcomeManager
    autoroles: AutoroleManager
    automod: AutomodManager
    roleGroups: RoleGroupManager
    twitch: TwitchManager
    api: APIManager
    queue: Queue
    hotReloadWatcher: HotReloadWatcher
    hotReloadManager: HotReloadManager

    public constructor(config: BotOptions) {
        super({
            shards: 'auto',
            intents: [
                IntentsBitField.Flags.Guilds,
                IntentsBitField.Flags.DirectMessages,
                IntentsBitField.Flags.GuildMessages,
                IntentsBitField.Flags.MessageContent,
                IntentsBitField.Flags.GuildMembers,
                IntentsBitField.Flags.GuildPresences,
                IntentsBitField.Flags.GuildIntegrations,
                IntentsBitField.Flags.DirectMessageTyping,
                IntentsBitField.Flags.GuildMessageReactions
            ],
            fetchPrefix: (m: Message) => this.settings.get(m.guild, 'prefix', config.defaultPrefix),
            caseInsensitiveCommands: true,
            caseInsensitivePrefixes: true,
            baseUserDirectory: path.join(__dirname, '..'),
            logger: { 'level': LogLevel.Info },
            defaultCooldown: {
                scope: BucketScope.User,
                delay: ms('3s'),
                limit: 3
            },
            subcommandDefaultCooldown: {
                scope: BucketScope.User,
                delay: ms('3s'),
                limit: 3
            },
            makeCache: Options.cacheEverything(),
            loadMessageCommandListeners: true,
            partials: [ Partials.Message, Partials.Channel, Partials.User, Partials.GuildMember, Partials.Reaction ],
            loadDefaultErrorListeners: true,
            loadSubcommandErrorListeners: true,
            loadApplicationCommandRegistriesStatusListeners: true,
            hmr: { enabled: true }
        })

        this.owner = config.owner
        this.token = config.token
    }

    private async _init() {
        await mongoose.connect(envs.dbServer).then(() => { this.logger.info('Connected to database successfully.') })

        const components = new Components(this)
        await components._loadAll()
    }

    public async start() {
        try {
            await this._init()
            return this.login(this.token)
        } catch (err) {
            this.logger.fatal('Failed to start bot. Invalid token provided.\n', err)
            process.exit(1)
        }
    }
}