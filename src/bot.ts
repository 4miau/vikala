import vikala from './client/vikala'
import { envs } from './lib/util/environmentVariables'
import '@sapphire/plugin-hmr'

const config = {
    owner: envs.owner,
    defaultPrefix: envs.defaultPrefix,
    token: Buffer.from(envs.token, 'base64').toString(),
    intents: Number(envs.intents)
}

new vikala(config).start()