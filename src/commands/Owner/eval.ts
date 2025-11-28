import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { AttachmentBuilder, Message } from 'discord.js'
import { createContext, Script } from 'node:vm'
import { codeBlock, isThenable } from '@sapphire/utilities'
import { Stopwatch } from '@sapphire/stopwatch'
import { inspect } from 'node:util'
import { send } from '@sapphire/plugin-editable-commands'

interface EvalResult {
    success: boolean
    time: string
    result: string
}

@ApplyOptions<Command.Options>({
    name: 'eval',
    aliases: ['ev', 'evaluate'],
    description: 'Evaluates and executes JavaScript code with advanced features.',
    detailedDescription: 'Evaluates JavaScript code with timeout support, context injection, and smart output handling. ' +
        'Supports async/await, imports, and various output formats.',
    usage: 'eval [flags] <code>',
    examples: [
        { example: 'eval 1 + 1', description: 'Simple mathematical evaluation.' },
        { example: 'eval --async await client.users.fetch("123456789")', description: 'Async operation with await.' },
        { example: 'eval --timeout=5000 console.log("Hello World")', description: 'Evaluation with 5 second timeout.' },
        { example: 'eval --silent process.env', description: 'Silent evaluation (no output).' },
        { example: 'eval --json message.guild', description: 'Output formatted as JSON.' }
    ],
    flags: ['async', 'silent', 'json', 'showHidden', 'hidden'],
    options: ['timeout', 'depth'],
    preconditions: ['OwnerOnly']
})
export class Eval extends Command {
    client = this.container.client
    private static readonly DEFAULT_TIMEOUT = 60000 // 60 seconds
    private static readonly MAX_OUTPUT_LENGTH = 2000

    private cachedContext: object | null = null

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const rawCode = await args.restResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!rawCode) return message.channel.send({ content: 'You must provide code to evaluate.' })

        const { code, detectedLanguage } = this.parseCodeInput(rawCode)

        const isAsync = args.getFlags('async')
        const isSilent = args.getFlags('silent')
        const isJson = args.getFlags('json') || detectedLanguage === 'json'
        const showHidden = args.getFlags('showHidden', 'hidden')
        const timeoutOption = args.getOption('timeout')
        const timeout = timeoutOption ? Number(timeoutOption) : Eval.DEFAULT_TIMEOUT
        const depthOption = args.getOption('depth')
        const depth = depthOption ? Number(depthOption) : 0

        const result = await this.executeCode(message, args, code, {
            async: isAsync,
            timeout: timeout,
            json: isJson,
            showHidden: showHidden,
            depth: depth
        })

        if (isSilent) {
            if (!result.success && result.result) {
                this.container.client.logger.error('EVAL ERROR', result.result)
            }
            return message.react('✅').catch(() => null)
        }

        return this.sendResult(message, result, isJson ? 'json' : 'js')
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const code = interaction.options.getString('code', true)
        const isAsync = interaction.options.getBoolean('async') || false
        const isSilent = interaction.options.getBoolean('silent') || false
        const isJson = interaction.options.getBoolean('json') || false
        const timeout = interaction.options.getInteger('timeout') || Eval.DEFAULT_TIMEOUT
        const depth = interaction.options.getInteger('depth') || 0

        const result = await this.executeCode(interaction, null, code, {
            async: isAsync,
            timeout: timeout,
            json: isJson,
            showHidden: false,
            depth: depth
        })

        if (isSilent) {
            if (!result.success && result.result) {
                this.container.client.logger.error('EVAL ERROR', result.result)
            }
            return interaction.reply({ content: '✅ Evaluation completed silently.', flags: ['Ephemeral'] })
        }

        const formatted = this.formatOutput(result, isJson ? 'json' : 'js')

        if (formatted.length > Eval.MAX_OUTPUT_LENGTH) {
            const attachment = new AttachmentBuilder(Buffer.from(result.result, 'utf8'), {
                name: `output.${isJson ? 'json' : 'js'}`
            })
            return interaction.reply({
                content: `**${result.success ? 'Output' : 'Error'}**: ${result.time}`,
                files: [attachment],
                flags: ['Ephemeral']
            })
        }

        return interaction.reply({ content: formatted, flags: ['Ephemeral'] })
    }

    private async executeCode(
        context: Message | Command.ChatInputCommandInteraction,
        args: Args | null,
        code: string,
        options: {
            async: boolean
            timeout: number
            json: boolean
            showHidden: boolean
            depth: number
        }
    ): Promise<EvalResult> {
        if (options.async) code = `(async () => {\n${code}\n})()`

        let script: Script
        try {
            script = new Script(code, { filename: 'eval' })
        } catch (error) {
            return {
                success: false,
                time: '💥 Syntax Error',
                result: (error as SyntaxError).message
            }
        }

        const evalContext = createContext({
            ...(await this.getEvalContext()),
            client: this.client,
            message: context instanceof Message ? context : null,
            interaction: context instanceof Message ? null : context,
            args: args,
            guild: context instanceof Message ? context.guild : (context as any).guild,
            channel: context instanceof Message ? context.channel : (context as any).channel,
            author: context instanceof Message ? context.author : (context as any).user,
            member: context instanceof Message ? context.member : (context as any).member
        })

        const stopwatch = new Stopwatch()
        let success: boolean
        let result: unknown
        let syncTime = ''
        let asyncTime = ''
        let wasThenable = false

        try {
            result = script.runInNewContext(evalContext, { timeout: options.timeout })
            syncTime = stopwatch.toString()

            if (isThenable(result)) {
                wasThenable = true
                stopwatch.restart()
                result = await result
                asyncTime = stopwatch.toString()
            }

            success = true
        } catch (error) {
            if (!syncTime) syncTime = stopwatch.toString()
            if (wasThenable && !asyncTime) asyncTime = stopwatch.toString()

            result = error
            success = false
        }

        stopwatch.stop()

        if (typeof result !== 'string') {
            if (result instanceof Error) {
                result = result.stack || result.message
            } else if (options.json) {
                try { result = JSON.stringify(result, null, 2) }
                catch { result = inspect(result, { depth: options.depth, showHidden: options.showHidden }) }
            } else {
                result = inspect(result, { depth: options.depth, showHidden: options.showHidden })
            }
        }

        return {
            success,
            time: this.formatTime(syncTime, asyncTime),
            result: this.cleanOutput(result as string)
        }
    }

    private async getEvalContext(): Promise<object> {
        if (!this.cachedContext) {
            const [
                buffer,
                crypto,
                events,
                fs,
                http,
                https,
                os,
                path,
                util,
                vm,
                discord,
                framework,
                utilities,
                decorators,
                stopwatch,
                editableCommands,
                axios,
                ms,
                emoji
            ] = await Promise.all([
                import('node:buffer'),
                import('node:crypto'),
                import('node:events'),
                import('node:fs'),
                import('node:http'),
                import('node:https'),
                import('node:os'),
                import('node:path'),
                import('node:util'),
                import('node:vm'),
                import('discord.js'),
                import('@sapphire/framework'),
                import('@sapphire/utilities'),
                import('@sapphire/decorators'),
                import('@sapphire/stopwatch'),
                import('@sapphire/plugin-editable-commands'),
                import('axios'),
                import('ms'),
                import('node-emoji')
            ])

            this.cachedContext = {
                // Safe Node.js globals (excluding browser-specific ones)
                console,
                Buffer,
                setTimeout,
                setInterval,
                clearTimeout,
                clearInterval,
                setImmediate,
                clearImmediate,

                // Node.js modules
                buffer,
                crypto,
                events,
                fs,
                http,
                https,
                os,
                path,
                process,
                url: await import('node:url'),
                util,
                vm,

                // Discord.js
                discord,

                // Sapphire Framework
                sapphire: {
                    framework,
                    utilities,
                    decorators,
                    stopwatch,
                    editableCommands
                },

                // Utilities
                axios,
                ms,
                emoji,
                send: editableCommands.send,

                // Bot structures
                vikala: {
                    settings: this.client.settings,
                    api: this.client.api,
                    tasks: this.client.tasks,
                    cases: this.client.cases,
                    queue: this.client.queue
                }
            }
        }

        return this.cachedContext
    }

    private parseCodeInput(input: string): { code: string; detectedLanguage: string | null } {
        input = input.trim()

        const codeBlockRegex = /^```(?:([a-zA-Z]+)(?:\s*\n|\s+))?([\s\S]*?)```$/
        const match = input.match(codeBlockRegex)

        if (match) {
            const language = match[1]?.toLowerCase() || null
            const code = match[2].trim()

            return {
                code,
                detectedLanguage: this.normalizeLanguage(language)
            }
        }

        return {
            code: input,
            detectedLanguage: null
        }
    }

    private normalizeLanguage(language: string | null): string | null {
        if (!language) return null

        switch (language) {
            case 'js':
            case 'javascript':
                return 'javascript'
            case 'ts':
            case 'typescript':
                return 'typescript'
            case 'json':
                return 'json'
            default:
                return language
        }
    }

    private formatTime(syncTime: string, asyncTime: string): string {
        if (!asyncTime) return `⏱️ ${syncTime}`
        return `⏱️ ${syncTime} (sync) + ${asyncTime} (async)`
    }

    private cleanOutput(text: string): string {
        return text
            .replace(new RegExp(this.client.token || 'undefined', 'gi'), '[TOKEN]')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
    }

    private formatOutput(result: EvalResult, language: string): string {
        const header = `**${result.success ? 'Output' : 'Error'}**: ${result.time}`
        const body = codeBlock(language, result.result || 'undefined')
        return `${header}${body}`
    }

    private async sendResult(message: Message, result: EvalResult, language: string): Promise<Message | null> {
        const formatted = this.formatOutput(result, language)

        if (formatted.length > Eval.MAX_OUTPUT_LENGTH) {
            const attachment = new AttachmentBuilder(Buffer.from(result.result, 'utf8'), {
                name: `output.${language}`
            })

            return send(message, {
                content: `**${result.success ? 'Output' : 'Error'}**: ${result.time}`,
                files: [attachment]
            })
        }

        return send(message, formatted)
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('eval')
                .setDescription('Evaluates JavaScript code')
                .addStringOption((option) =>
                    option
                        .setName('code')
                        .setDescription('The JavaScript code to evaluate')
                        .setRequired(true)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('async')
                        .setDescription('Whether to wrap the code in an async function')
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('silent')
                        .setDescription('Whether to suppress output')
                        .setRequired(false)
                )
                .addBooleanOption((option) =>
                    option
                        .setName('json')
                        .setDescription('Whether to format output as JSON')
                        .setRequired(false)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('timeout')
                        .setDescription('Timeout in milliseconds (default: 60000)')
                        .setRequired(false)
                        .setMinValue(1000)
                        .setMaxValue(300000)
                )
                .addIntegerOption((option) =>
                    option
                        .setName('depth')
                        .setDescription('Object inspection depth (default: 0)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(10)
                )
        )
    }
}