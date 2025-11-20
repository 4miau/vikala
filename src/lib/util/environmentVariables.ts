import dotenv from 'dotenv'
import { join } from 'path'

function _getEnvs() {
    const vars = dotenv.config({ path: join(__dirname, '..', '..', '..', '.env' ) })

    if (vars.error) throw new Error('There was an error locating or parsing the .env file.\n' + vars.error.message)
    else return vars.parsed
}

export const envs = _getEnvs()