import express from 'express'
import Vikala from '../client/vikala'
import { envs } from '../lib/util/environmentVariables'

export default class Router {
	app: express.Express
	client: Vikala

	constructor(client: Vikala) {
		this.client = client
		this.app = express()

		this.routes()
	}

	routes() {
		this.app.listen(envs.port)

		this.app.get('/', (_, res) => {
			res.send('Vikky is running!')
		})

		this.app.get('/twitch', (_, res) => {
			res.send('Twitch endpoint')
		})
	}
}
