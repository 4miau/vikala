import axios from 'axios'
import { AxiosRequestConfig } from 'axios'
import Vikala from '../client/vikala'

export class APIManager {
	client: Vikala
	readonly config: AxiosRequestConfig

	constructor(client: Vikala, config: AxiosRequestConfig) {
		this.client = client
		this.config = config
	}

	async call(log?: boolean): Promise<any> {
		if (this.client.queue.isRunning) return this.callDirect(log)

		return this.client.queue.add(async () => {
			try {
				const response = await axios(this.config)
				if (log) this.client.logger.info('API CALL', response.data)
				this.reset()
				return response.data
			} catch (error) {
				throw error
			}
		})
	}

	async callDirect(log?: boolean): Promise<any> {
		try {
			const response = await axios(this.config)
			if (log) this.client.logger.info('API CALL', response.data)
			this.reset()
			return response.data
		} catch (error) {
			throw error
		}
	}

	set(config: any) {
		for (const key in config) {
			this.config[key] = config[key]
		}
		return this
	}

	getUri(): string {
		return axios.getUri(this.config)
	}

	reset(config: AxiosRequestConfig = { method: 'GET', url: '', params: {}, headers: {} }) {
		for (const key in config) {
			this.config[key] &&= config[key]
		}
		return this
	}
}

export default APIManager
