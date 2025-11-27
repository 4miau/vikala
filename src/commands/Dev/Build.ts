import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message, TextChannel } from 'discord.js'
import { join } from 'path'
import { arrayEmpty, capitalize } from 'miau-utilities'
import { existsSync, readdirSync, statSync } from 'fs'

declare type ModuleType = 'command' | 'listener' | 'precondition' | 'task' | 'arguments'

@ApplyOptions<Command.Options>({
    name: 'build',
    aliases: ['load'],
    description: 'Loads a file/module into the bot. Supports both simple names (ping) and full paths (General/Ping.js).',
    usage: 'build <file> <type>',
    examples: [
        { example: 'build ping command', description: 'Loads the ping command (searches automatically for General/Ping.js).' },
        { example: 'build General/Ping.js command', description: 'Loads the command with explicit category path.' }
    ],
    preconditions: ['OwnerOnly']
})
export class Build extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const file: string = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!file) return message.channel.send({ content: 'Provide a file/module to build.' })

        const type: ModuleType = await args.pickResult('enum', { enum: ['command', 'listener', 'precondition', 'task', 'arguments'] })
            .then(res => res.isOk() ? res.unwrap() as ModuleType : null)
        if (!type) return message.channel.send({ content: 'Provide a type of module to build.' })

        return this.handleBuildModule(file, type, (content) => (message.channel as TextChannel).send(content))
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const file = interaction.options.getString('file', true)
        const type = interaction.options.getString('type', true) as ModuleType

        return this.handleBuildModule(file, type, (content) => interaction.reply({ ...content, flags: ['Ephemeral'] }))
    }

    private async handleBuildModule(file: string, type: ModuleType, sendFn: (content: any) => Promise<any>) {
        const moduleStores = {
            command: this.client.commandStore,
            listener: this.client.listenerStore,
            precondition: this.client.preconditions,
            task: this.client.tasks,
            arguments: this.client.arguments
        }

        const modulePaths = {
            command: join(__dirname, '..'),
            listener: join(__dirname, '..', '..', 'events'),
            precondition: join(__dirname, '..', '..', 'preconditions'),
            task: join(__dirname, '..', '..', 'tasks'),
            arguments: join(__dirname, '..', '..', 'arguments')
        }

        const store = moduleStores[type]
        const basePath = modulePaths[type]
        if (!store || !basePath) return sendFn({ content: 'Invalid module type provided.' })

        const foundFilePath = this.findModuleFile(basePath, file)
        if (!foundFilePath) {
            return sendFn({ content: `${capitalize(type)} \`${file}\` was not found.` })
        }

        try {
            const success = await store.load(basePath, foundFilePath)
            if (!success || success.length === 0) {
                return sendFn({ content: `${capitalize(type)} \`${file}\` was not found.` })
            }
            return sendFn({ content: `${capitalize(type)} \`${file}\` has been built successfully.` })
        } catch (error) {
            return sendFn({ content: `${capitalize(type)} \`${file}\` was not found.` })
        }
    }

    private findModuleFile(basePath: string, fileName: string): string | null {
        const normalizedFile = fileName.endsWith('.js') ? fileName : `${fileName}.js`

        if (normalizedFile.includes('/')) {
            const exactPath = join(basePath, normalizedFile)
            if (existsSync(exactPath)) return normalizedFile
        }

        const directPath = join(basePath, normalizedFile)
        if (existsSync(directPath)) return normalizedFile

        return this.searchInDirectories(basePath, normalizedFile, '')
    }

    private searchInDirectories(currentPath: string, targetFile: string, relativePath: string): string | null {
        if (!existsSync(currentPath)) return null

        try {
            const items = readdirSync(currentPath)

            for (const item of items) {
                const fullPath = join(currentPath, item)
                const stat = statSync(fullPath)

                if (stat.isFile()) {
                    if (item.toLowerCase() === targetFile.toLowerCase()) {
                        return relativePath ? `${relativePath}/${item}` : item
                    }
                }
            }

            for (const item of items) {
                const fullPath = join(currentPath, item)
                const stat = statSync(fullPath)

                if (stat.isDirectory()) {
                    const newRelativePath = relativePath ? `${relativePath}/${item}` : item
                    const found = this.searchInDirectories(fullPath, targetFile, newRelativePath)
                    if (found) return found
                }
            }
        } catch {
        }

        return null
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('build')
                .setDescription('Loads a file into the bot. Supports simple names (ping) or full paths (General/Ping.js).')
                .addStringOption((option) =>
                    option
                        .setName('file')
                        .setDescription('The file/module to build.')
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName('type')
                        .setDescription('The type of module to build.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Command', value: 'command' },
                            { name: 'Listener', value: 'listener' },
                            { name: 'Precondition', value: 'precondition' },
                            { name: 'Task', value: 'task' },
                            { name: 'Arguments', value: 'arguments' }
                        )
                )
        )
    }
}