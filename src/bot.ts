import vikala from './client/vikala'
import { envs } from './lib/util/environmentVariables'

const config = {
	owner: envs.owner,
	defaultPrefix: envs.defaultPrefix,
	token: envs.token
}

new vikala(config).start()
