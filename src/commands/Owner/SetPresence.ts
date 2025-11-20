import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { ActivityType, EmbedBuilder, Message } from 'discord.js'
import ms from 'ms'

import { ActivityStatus } from '../../typings/@definitions/Arguments'

@ApplyOptions<Subcommand.Options>({
    name: 'setpresence',
    aliases: ['presence'],
    description: 'Manage bot presence settings',
    detailedDescription: 'Set, manage, and view the bot\'s presence and activity settings.',
    usage: 'setpresence <set|cycle|add|remove|list|interval|status> [options]',
    examples: [
        { example: 'setpresence set Playing online "with Discord APIs"', description: 'Sets the bot presence to "Playing with Discord APIs" with an online status.' },
        { example: 'setpresence set Streaming dnd "coding" "https://twitch.tv/4miau"', description: 'Sets streaming presence with Twitch URL.' },
        { example: 'setpresence cycle start', description: 'Starts automatic presence cycling.' },
        { example: 'setpresence add "chilling" Watching idle', description: 'Adds a new presence "Watching chilling" with idle status to the cycle list.' },
        { example: 'setpresence add "live coding" Streaming dnd "https://twitch.tv/4miau"', description: 'Adds a streaming presence with URL to the cycle list.' },
        { example: 'setpresence remove 2', description: 'Removes the presence at index 2 from the cycle list.' },
        { example: 'setpresence list', description: 'Lists all presences in the cycle.' },
        { example: 'setpresence interval 10m', description: 'Sets the cycling interval to 10 minutes.' },
        { example: 'setpresence status', description: 'Displays the current status of the presence manager.' }
    ],
    preconditions: ['OwnerOnly'],
    subcommands: [
        { name: 'set', chatInputRun: 'chatInputSet', messageRun: 'messageSet' },
        { name: 'cycle', chatInputRun: 'chatInputCycle', messageRun: 'messageCycle' },
        { name: 'add', chatInputRun: 'chatInputAdd', messageRun: 'messageAdd' },
        { name: 'remove', chatInputRun: 'chatInputRemove', messageRun: 'messageRemove' },
        { name: 'list', chatInputRun: 'chatInputList', messageRun: 'messageList', default: true },
        { name: 'interval', chatInputRun: 'chatInputInterval', messageRun: 'messageInterval' },
        { name: 'status', chatInputRun: 'chatInputStatus', messageRun: 'messageStatus' }
    ]
})
export class SetPresence extends Subcommand {
    client = this.container.client

    public async messageSet(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const type = await args.pickResult('activitytype').then(res => res.isOk() ? res.unwrap() as ActivityType : ActivityType.Playing)
        const status = await args.pickResult('activitystatus').then(res => res.isOk() ? res.unwrap() : 'online')

        const activityData = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const url = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!type || !status) {
            return message.channel.send('Usage: `setpresence set <type> <status> [activity] [url]`')
        }

        try {
            this.client.presences.setManualPresence(activityData || '', type, status, url || undefined)
            return message.channel.send(`✅ Presence set to **${ActivityType[type]}** *${activityData || 'No activity'}* (${status})`)
        } catch (error) {
            return message.channel.send('❌ Failed to set presence.')
        }
    }

    public async chatInputSet(interaction: Subcommand.ChatInputCommandInteraction) {
        const type = interaction.options.getNumber('type', true) as ActivityType
        const status = interaction.options.getString('status', true) as ActivityStatus
        const activityData = interaction.options.getString('activitydata') || ''
        const url = interaction.options.getString('url')

        try {
            this.client.presences.setManualPresence(activityData, type, status, url || undefined)
            return interaction.reply({ 
                content: `✅ Presence set to **${ActivityType[type]}** *${activityData || 'No activity'}* (${status})`, 
                flags: ['Ephemeral']
            })
        } catch (error) {
            return interaction.reply({ content: '❌ Failed to set presence.', flags: ['Ephemeral'] })
        }
    }

    public async messageCycle(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const action = await args.pickResult('string').then(res => res.isOk() ? res.unwrap().toLowerCase() : 'toggle')

        if (action === 'start' || action === 'on' || (action === 'toggle' && !this.client.presences.isCycling())) {
            this.client.presences.startCycling()
            return message.channel.send('🔄 Presence cycling **started**')
                } else if (action === 'stop' || action === 'off' || (action === 'toggle' && this.client.presences.isCycling())) {
            this.client.presences.stopCycling()
            return message.channel.send('⏹️ Presence cycling **stopped**')
        } else if (action === 'resume') {
            this.client.presences.resumeCycling()
            return message.channel.send('▶️ Resumed automatic cycling (manual override disabled)')
        } else {
            return message.channel.send('Usage: `setpresence cycle [start|stop|resume|toggle]`')
        }
    }

    public async chatInputCycle(interaction: Subcommand.ChatInputCommandInteraction) {
        const action = interaction.options.getString('action', true)

        if (action === 'start') {
            this.client.presences.startCycling()
            return interaction.reply({ content: '🔄 Presence cycling **started**', flags: ['Ephemeral'] })
        } else if (action === 'stop') {
            this.client.presences.stopCycling()
            return interaction.reply({ content: '⏹️ Presence cycling **stopped**', flags: ['Ephemeral'] })
        } else if (action === 'resume') {
            this.client.presences.resumeCycling()
            return interaction.reply({ content: '▶️ Resumed automatic cycling', flags: ['Ephemeral'] })
        }
    }

    public async messageAdd(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const name = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        const type = await args.pickResult('activitytype').then(res => res.isOk() ? res.unwrap() as ActivityType : ActivityType.Playing)
        const status = await args.pickResult('activitystatus').then(res => res.isOk() ? res.unwrap() : 'online' as ActivityStatus)
        const url = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)

        if (!name) return message.channel.send('Usage: `setpresence add <name> [type] [status] [url]`')

        try {
            await this.client.presences.addPresence(name, type, status, url || undefined)
            return message.channel.send(`✅ Added "**${name}**" (${ActivityType[type as ActivityType]}, ${status}) to cycle`)
        } catch (error) {
            return message.channel.send('❌ Failed to add presence to cycle.')
        }
    }

    public async chatInputAdd(interaction: Subcommand.ChatInputCommandInteraction) {
        const name = interaction.options.getString('name', true)
        const type = interaction.options.getNumber('type') as ActivityType || ActivityType.Playing
        const status = interaction.options.getString('status') as ActivityStatus || 'online'
        const url = interaction.options.getString('url')

        try {
            await this.client.presences.addPresence(name, type, status, url || undefined)
            return interaction.reply({ 
                content: `✅ Added "**${name}**" (${ActivityType[type]}, ${status}) to cycle`, 
                flags: ['Ephemeral'] 
            })
        } catch (error) {
            return interaction.reply({ content: '❌ Failed to add presence to cycle.', flags: ['Ephemeral'] })
        }
    }

    public async messageRemove(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const index = await args.pickResult('number').then(res => res.isOk() ? res.unwrap() - 1 : null)
        if (index === null) return message.channel.send('Usage: `setpresence remove <index>` (use `setpresence list` to see indices)')

        try {
            await this.client.presences.removePresence(index)
            return message.channel.send(`✅ Removed presence at index **${index}**`)
        } catch (error) {
            return message.channel.send('❌ Invalid index or failed to remove presence.')
        }
    }

    public async chatInputRemove(interaction: Subcommand.ChatInputCommandInteraction) {
        const index = interaction.options.getNumber('index', true) - 1

        try {
            await this.client.presences.removePresence(index)
            return interaction.reply({ content: `✅ Removed presence at index ${index + 1}`, flags: ['Ephemeral'] })
        } catch (error) {
            return interaction.reply({ content: '❌ Invalid index or failed to remove presence.', flags: ['Ephemeral'] })
        }
    }

    public async messageList(message: Message) {
        if (!message.channel.isSendable()) return

        const presences = this.client.presences.getPresences()
        const embed = this.buildPresenceListEmbed(presences)
        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputList(interaction: Subcommand.ChatInputCommandInteraction) {
        const presences = this.client.presences.getPresences()
        const embed = this.buildPresenceListEmbed(presences)
        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageInterval(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const intervalStr = await args.pickResult('string').then(res => res.isOk() ? res.unwrap() : null)
        if (!intervalStr) return message.channel.send('Usage: `setpresence interval <time>` (e.g., 5m, 30s, 2h)')

        try {
            const intervalMs = ms(intervalStr as any)
            if (typeof intervalMs !== 'number' || intervalMs < ms('30s')) throw new Error('Minimum interval is 30 seconds')
            
            await this.client.presences.setInterval(intervalMs)
            return message.channel.send(`⏱️ Cycling interval set to **${ms(intervalMs, { long: true })}**`)
        } catch (error) {
            return message.channel.send('❌ Invalid time format. Use formats like: 5m, 30s, 2h')
        }
    }

    public async chatInputInterval(interaction: Subcommand.ChatInputCommandInteraction) {
        const intervalStr = interaction.options.getString('time', true)

        try {
            const intervalMs = ms(intervalStr as any)
            if (typeof intervalMs !== 'number' || intervalMs < 30000) throw new Error('Minimum interval is 30 seconds')
            
            await this.client.presences.setInterval(intervalMs)
            return interaction.reply({ 
                content: `⏱️ Cycling interval set to **${ms(intervalMs, { long: true })}**`, 
                flags: ['Ephemeral'] 
            })
        } catch (error) {
            return interaction.reply({ 
                content: '❌ Invalid time format. Use formats like: 5m, 30s, 2h', 
                flags: ['Ephemeral'] 
            })
        }
    }

    public async messageStatus(message: Message) {
        if (!message.channel.isSendable()) return
        const embed = this.buildStatusEmbed()
        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputStatus(interaction: Subcommand.ChatInputCommandInteraction) {
        const embed = this.buildStatusEmbed()
        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    private buildPresenceListEmbed(presences: any[]) {
        const embed = new EmbedBuilder()
            .setTitle('🎭 Presence Cycle List')
            .setColor(0x7C3AED)
            .setTimestamp()

        if (presences.length === 0) {
            embed.setDescription('No presences in cycle list.')
        } else {
            const list = presences.map((p, i) => 
                `${i + 1}. **${ActivityType[p.type]}** *${p.name}* (${p.status})`
            ).join('\n')
            embed.setDescription(list)
        }

        return embed
    }

    private buildStatusEmbed() {
        const isCycling = this.client.presences.isCycling()
        const isOverridden = this.client.presences.isOverridden()
        const interval = ms(this.client.presences.getInterval(), { long: true })
        const presenceCount = this.client.presences.getPresences().length
        
        const embed = new EmbedBuilder()
            .setTitle('🎭 Presence Manager Status')
            .setColor(isCycling ? 0x10B981 : 0xEF4444)
            .addFields(
                { name: 'Cycling', value: isCycling ? '✅ Active' : '❌ Stopped', inline: true },
                { name: 'Manual Override', value: isOverridden ? '🔒 Enabled' : '🔓 Disabled', inline: true },
                { name: 'Interval', value: interval, inline: true },
                { name: 'Presences in Cycle', value: presenceCount.toString(), inline: true }
            )
            .setTimestamp()

        return embed
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('setpresence')
                .setDescription('Manage bot presence settings')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('set')
                        .setDescription('Set a manual presence')
                        .addNumberOption((option) =>
                            option
                                .setName('type')
                                .setDescription('The activity type')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Playing', value: 0 },
                                    { name: 'Streaming', value: 1 },
                                    { name: 'Listening', value: 2 },
                                    { name: 'Watching', value: 3 },
                                    { name: 'Competing', value: 5 }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('status')
                                .setDescription('The activity status')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Online', value: 'online' },
                                    { name: 'Idle', value: 'idle' },
                                    { name: 'Do Not Disturb', value: 'dnd' },
                                    { name: 'Invisible', value: 'invisible' }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('activitydata')
                                .setDescription('The activity data (what to display as activity)')
                                .setRequired(false)
                        )
                        .addStringOption((option) =>
                            option
                                .setName('url')
                                .setDescription('URL for streaming activity (e.g., https://twitch.tv/4miau)')
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('cycle')
                        .setDescription('Control presence cycling')
                        .addStringOption((option) =>
                            option
                                .setName('action')
                                .setDescription('Cycling action')
                                .setRequired(true)
                                .addChoices(
                                    { name: 'Start', value: 'start' },
                                    { name: 'Stop', value: 'stop' },
                                    { name: 'Resume', value: 'resume' }
                                )
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('add')
                        .setDescription('Add presence to cycle list')
                        .addStringOption((option) =>
                            option
                                .setName('name')
                                .setDescription('The activity name')
                                .setRequired(true)
                        )
                        .addNumberOption((option) =>
                            option
                                .setName('type')
                                .setDescription('The activity type')
                                .setRequired(false)
                                .addChoices(
                                    { name: 'Playing', value: 0 },
                                    { name: 'Streaming', value: 1 },
                                    { name: 'Listening', value: 2 },
                                    { name: 'Watching', value: 3 },
                                    { name: 'Competing', value: 5 }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('status')
                                .setDescription('The activity status')
                                .setRequired(false)
                                .addChoices(
                                    { name: 'Online', value: 'online' },
                                    { name: 'Idle', value: 'idle' },
                                    { name: 'Do Not Disturb', value: 'dnd' },
                                    { name: 'Invisible', value: 'invisible' }
                                )
                        )
                        .addStringOption((option) =>
                            option
                                .setName('url')
                                .setDescription('URL for streaming activity (e.g., https://twitch.tv/4miau)')
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('remove')
                        .setDescription('Remove presence from cycle list')
                        .addNumberOption((option) =>
                            option
                                .setName('index')
                                .setDescription('The index of the presence to remove')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand.setName('list').setDescription('List all presences in cycle')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('interval')
                        .setDescription('Set cycling interval')
                        .addStringOption((option) =>
                            option
                                .setName('time')
                                .setDescription('Time interval (e.g., 5m, 30s, 2h)')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand.setName('status').setDescription('Show current presence manager status')
                )
        )
    }
}