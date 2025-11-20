import { Subcommand } from '@sapphire/plugin-subcommands'
import { TaskStore } from '../../stores/TaskStore'

import * as args from './Arguments'

declare type Example = {
    example: string
    description: string
}

declare module '@sapphire/framework' {
    export interface Preconditions {
        OwnerOnly: never
    }

    interface ArgType {
        logtype: args.LogType
        sendablechannel: args.SendableChannel
        guild: Guild
        activitytype: number
        activitystatus: args.ActivityStatus
    }

    interface CommandOptions {
        usage?: string
        examples?: Example[]
    }

    interface SubcommandOptions {
        usage?: string
        examples?: Example[]
    }
}

declare module '@sapphire/pieces' {
    export interface StoreRegistryEntries {
        tasks: TaskStore
    }
}