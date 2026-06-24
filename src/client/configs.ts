import path from 'path'

import Vikala from './vikala'
import Queue from '../structures/Queue'
import APIManager from '../structures/APIManager'
import SettingsProvider from '../structures/SettingsProvider'
import Settings from '../database/Settings'
import { TaskStore } from '../stores/TaskStore'
import TwitchManager from '../structures/TwitchManager'
import Sheets from '../structures/SheetsManager'
import Router from '../router/Router'
import ModLogger from '../structures/ModLogger'
import EventLogger from '../structures/EventLogger'
import PresenceManager from '../structures/PresenceManager'
import LevelingManager from '../structures/LevelingManager'
import WelcomeManager from '../structures/WelcomeManager'
import AutoroleManager from '../structures/AutoroleManager'
import AutomodManager from '../structures/AutomodManager'
import RoleGroupManager from '../structures/RoleGroupManager'
import ReloadManager from '../structures/ReloadManager'
import ThreadManager from '../structures/ThreadManager'
import ChannelSnapshotManager from '../structures/ChannelSnapshotManager'
import VerificationManager from '../structures/VerificationManager'

export default class Components {
	client: Vikala

	public constructor(cli: Vikala) {
		this.client = cli
	}

	async _loadAll() {
		this._createStores()
		await this._createStructs()
	}

	private _createStores() {
		this.client.stores.register(new TaskStore())

		this.client.stores.get('arguments').registerPath(path.join(__dirname, '..', 'arguments'))
		this.client.stores.get('commands').registerPath(path.join(__dirname, '..', 'commands'))
		this.client.stores.get('listeners').registerPath(path.join(__dirname, '..', 'events'))
		this.client.stores.get('preconditions').registerPath(path.join(__dirname, '..', 'preconditions'))
		this.client.stores.get('tasks').registerPath(path.join(__dirname, '..', 'tasks'))

		this.client.commandStore = this.client.stores.get('commands')
		this.client.listenerStore = this.client.stores.get('listeners')
		this.client.tasks = this.client.stores.get('tasks')
		this.client.arguments = this.client.stores.get('arguments')
		this.client.preconditions = this.client.stores.get('preconditions')
	}

	private async _createStructs() {
		const apiConfig = { method: 'GET', url: '', params: {}, headers: {} }

		this.client.cases = new ModLogger(this.client)
		this.client.events = new EventLogger(this.client)

		this.client.queue = new Queue(this.client)

		this.client.api = new APIManager(this.client, apiConfig)

		this.client.settings = new SettingsProvider(Settings)
		await this.client.settings._init()

		this.client.twitch = new TwitchManager(this.client)
		await this.client.twitch._init()

		this.client.router = new Router(this.client)

		this.client.sheets = new Sheets(this.client)
		await this.client.sheets._init()

		this.client.presences = new PresenceManager(this.client)
		await this.client.presences._init()

		this.client.leveling = new LevelingManager(this.client)
		await this.client.leveling._init()

		this.client.welcome = new WelcomeManager(this.client)
		await this.client.welcome._init()

		this.client.autoroles = new AutoroleManager()

		this.client.automod = new AutomodManager(this.client)

		this.client.roleGroups = new RoleGroupManager(this.client)

		this.client.threads = new ThreadManager(this.client)
		await this.client.threads._init()

		this.client.channelSnapshots = new ChannelSnapshotManager(this.client)
		await this.client.channelSnapshots._init()

		this.client.verification = new VerificationManager(this.client)

		this.client.reloadManager = new ReloadManager(this.client)
	}
}
