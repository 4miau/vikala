import dotenv from 'dotenv'
import { join } from 'path'

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') })
export const envs = process.env as NodeJS.ProcessEnv
