import { Args } from '@sapphire/framework'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { ApplyOptions } from '@sapphire/decorators'
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, Message, ButtonStyle, ComponentType } from 'discord.js'
import ms from 'ms'

import { paginate } from 'miau-utilities'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Subcommand.Options>({
    name: 'cases',
    aliases: ['case'],
    description: 'View moderation cases and event logs',
    detailedDescription: 'Comprehensive case management system for viewing moderation actions and server event logs with filtering and search capabilities.',
    requiredUserPermissions: ['ModerateMembers'],
    examples: [
        { example: 'cases recent', description: 'Show 10 most recent cases and events.' },
        { example: 'cases recent 25', description: 'Show 25 most recent cases and events.' },
        { example: 'cases view 123', description: 'View specific case or event log by ID.' },
        { example: 'cases user @member', description: 'Show all cases and events for a user.' },
        { example: 'cases user 123456789', description: 'Show cases by user ID.' },
        { example: 'cases moderation', description: 'Show only moderation cases (bans, kicks, etc).' },
        { example: 'cases events', description: 'Show only event logs (messages, channels, etc).' }
    ],
    subcommands: [
        { name: 'recent', chatInputRun: 'chatInputRecent', messageRun: 'messageRecent', default: true },
        { name: 'view', chatInputRun: 'chatInputView', messageRun: 'messageView' },
        { name: 'user', chatInputRun: 'chatInputUser', messageRun: 'messageUser' },
        { name: 'moderation', chatInputRun: 'chatInputModeration', messageRun: 'messageModeration' },
        { name: 'events', chatInputRun: 'chatInputEvents', messageRun: 'messageEvents' }
    ]
})
export class CasesCommand extends Subcommand {
    private client = this.container.client
    private static readonly CASES_PER_PAGE = 10
    private static readonly COLLECTOR_TIME = ms('5m')

    public async messageRecent(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const requestedLimit = await args.pickResult('number').then(res => res.isOk() ? Math.min(res.unwrap(), 100) : 50)

        const [modCases, eventLogs] = await Promise.all([
            this.client.cases.getLatestCases(message.guild, requestedLimit),
            this.client.events.getLatestEventLogs(message.guild, requestedLimit)
        ])

        const allCases = [...modCases, ...eventLogs]
            .sort((a, b) => b.caseId - a.caseId)

        if (allCases.length === 0) {
            return message.channel.send('❌ No recent cases or events found for this server.')
        }

        const [firstPageCases, totalPages] = paginate(allCases, 1, CasesCommand.CASES_PER_PAGE)
        const embed = this.buildCasesEmbed(firstPageCases, 1, totalPages, allCases.length)
        const row = this.createPaginationRow(1, totalPages)

        const response = await message.channel.send({ embeds: [embed], components: totalPages > 1 ? [row] : [] })

        if (totalPages > 1) {
            this.setupPaginationCollector(response, allCases, totalPages)
        }
    }

    public async chatInputRecent(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const requestedLimit = Math.min(interaction.options.getInteger('limit') || 50, 100)

        const [modCases, eventLogs] = await Promise.all([
            this.client.cases.getLatestCases(interaction.guild, requestedLimit),
            this.client.events.getLatestEventLogs(interaction.guild, requestedLimit)
        ])

        const allCases = [...modCases, ...eventLogs]
            .sort((a, b) => b.caseId - a.caseId)

        if (allCases.length === 0) {
            return interaction.reply({ content: '❌ No recent cases or events found for this server.', flags: ['Ephemeral'] })
        }

        const [firstPageCases, totalPages] = paginate(allCases, 1, CasesCommand.CASES_PER_PAGE)
        const embed = this.buildCasesEmbed(firstPageCases, 1, totalPages, allCases.length)
        const row = this.createPaginationRow(1, totalPages)

        const response = await interaction.reply({ embeds: [embed], components: totalPages > 1 ? [row] : [] })

        if (totalPages > 1) {
            this.setupPaginationCollector(response, allCases, totalPages)
        }
    }

    public async messageView(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const caseId = await args.pickResult('number')
        if (!caseId.ok) return message.channel.send('❌ Please provide a valid case ID.\nExample: `cases view 123`')

        const id = caseId.unwrap()

        const [modCase, eventLog] = await Promise.all([
            this.client.cases.getCase(message.guild, id),
            this.client.events.getEventLog(message.guild, id)
        ])

        if (!modCase && !eventLog) {
            return message.channel.send(`❌ No case or event found with ID ${id}.`)
        }

        const embed = new EmbedBuilder()
            .setColor(modCase ? Colors.Orange : Colors.Blurple)

        if (modCase) {
            embed.setTitle(`🔨 Moderation Case #${id}`)
            embed.setDescription(this.client.cases.formatCase(modCase))
        } else if (eventLog) {
            embed.setTitle(`📝 Event Log #${id}`)
            embed.setDescription(this.client.events.formatEventLog(eventLog))
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputView(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const caseId = interaction.options.getInteger('case_id', true)

        const [modCase, eventLog] = await Promise.all([
            this.client.cases.getCase(interaction.guild, caseId),
            this.client.events.getEventLog(interaction.guild, caseId)
        ])

        if (!modCase && !eventLog) {
            return interaction.reply({ content: `❌ No case or event found with ID ${caseId}.`, flags: ['Ephemeral'] })
        }

        const embed = new EmbedBuilder()
            .setColor(modCase ? Colors.Orange : Colors.Blurple)

        if (modCase) {
            embed.setTitle(`🔨 Moderation Case #${caseId}`)
            embed.setDescription(this.client.cases.formatCase(modCase))
        } else if (eventLog) {
            embed.setTitle(`📝 Event Log #${caseId}`)
            embed.setDescription(this.client.events.formatEventLog(eventLog))
        }

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageUser(message: Message, args: Args) {
        if (!message.guild || !message.channel.isSendable()) return

        const user = await args.pickResult('user').then(res => res.isOk() ? res.unwrap() : null)
        if (!user) return message.channel.send('❌ Please mention a valid user.\nExample: `cases user @member`')

        const [modCases, eventLogs] = await Promise.all([
            this.client.cases.getCasesByUser(message.guild, user.id, 15),
            this.client.events.getEventLogsByUser(message.guild, user.id, 15)
        ])

        const totalCases = modCases.length + eventLogs.length
        if (totalCases === 0) return message.channel.send(`❌ No cases or events found for **${user.username}**.`)

        const allCases = [...modCases, ...eventLogs]
            .sort((a, b) => b.caseId - a.caseId)
            .slice(0, 15)

        const embed = new EmbedBuilder()
            .setTitle(`📋 Cases for ${user.username}`)
            .setColor(Colors.Blurple)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`Found ${totalCases} case(s) and event(s)`)

        let description = ''
        for (const caseData of allCases) {
            if ('action' in caseData) {
                description += this.client.cases.formatCase(caseData) + '\n'
            } else {
                description += this.client.events.formatEventLog(caseData) + '\n'
            }
        }

        embed.setDescription(description || 'No cases found')

        if (totalCases > 15) {
            embed.setFooter({ text: `Showing first 15 of ${totalCases} cases` })
        }

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputUser(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const user = interaction.options.getUser('user', true)

        const [modCases, eventLogs] = await Promise.all([
            this.client.cases.getCasesByUser(interaction.guild, user.id),
            this.client.events.getEventLogsByUser(interaction.guild, user.id)
        ])

        const totalCases = modCases.length + eventLogs.length

        if (totalCases === 0) {
            return interaction.reply({ content: `❌ No cases or events found for **${user.username}**.`, flags: ['Ephemeral'] })
        }

        const allCases = [...modCases, ...eventLogs]
            .sort((a, b) => b.caseId - a.caseId)
            .slice(0, 15)

        const embed = new EmbedBuilder()
            .setTitle(`📋 Cases for ${user.username}`)
            .setColor(Colors.Blurple)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(`Found ${totalCases} case(s) and event(s)`)

        let description = ''
        for (const caseData of allCases) {
            if ('action' in caseData) description += this.client.cases.formatCase(caseData) + '\n'
            else description += this.client.events.formatEventLog(caseData) + '\n'
        }

        embed.setDescription(description || 'No cases found')

        if (totalCases > 15) embed.setFooter({ text: `Showing first 15 of ${totalCases} cases` })

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageModeration(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const modCases = await this.client.cases.getLatestCases(message.guild, 15)

        if (modCases.length === 0) {
            return message.channel.send('❌ No moderation cases found for this server.')
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔨 Recent Moderation Cases`)
            .setColor(Colors.Orange)
            .setDescription(`Showing ${modCases.length} recent moderation actions`)

        let description = ''
        for (const caseData of modCases) {
            description += this.client.cases.formatCase(caseData) + '\n'
        }

        embed.setDescription(description || 'No moderation cases found')

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputModeration(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const modCases = await this.client.cases.getLatestCases(interaction.guild, 15)

        if (modCases.length === 0) {
            return interaction.reply({ content: '❌ No moderation cases found for this server.', flags: ['Ephemeral'] })
        }

        const embed = new EmbedBuilder()
            .setTitle(`🔨 Recent Moderation Cases`)
            .setColor(Colors.Orange)
            .setDescription(`Showing ${modCases.length} recent moderation actions`)

        let description = ''
        for (const caseData of modCases) {
            description += this.client.cases.formatCase(caseData) + '\n'
        }

        embed.setDescription(description || 'No moderation cases found')

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    public async messageEvents(message: Message) {
        if (!message.guild || !message.channel.isSendable()) return

        const eventLogs = await this.client.events.getLatestEventLogs(message.guild, 15)

        if (eventLogs.length === 0) {
            return message.channel.send('❌ No event logs found for this server.')
        }

        const embed = new EmbedBuilder()
            .setTitle(`📝 Recent Event Logs`)
            .setColor(Colors.Blurple)
            .setDescription(`Showing ${eventLogs.length} recent server events`)

        let description = ''
        for (const eventLog of eventLogs) {
            description += this.client.events.formatEventLog(eventLog) + '\n'
        }

        embed.setDescription(description || 'No event logs found')

        return message.channel.send({ embeds: [embed] })
    }

    public async chatInputEvents(interaction: Subcommand.ChatInputCommandInteraction) {
        if (!interaction.guild) return

        const eventLogs = await this.client.events.getLatestEventLogs(interaction.guild, 15)

        if (eventLogs.length === 0) {
            return interaction.reply({ content: '❌ No event logs found for this server.', flags: ['Ephemeral'] })
        }

        const embed = new EmbedBuilder()
            .setTitle(`📝 Recent Event Logs`)
            .setColor(Colors.Blurple)
            .setDescription(`Showing ${eventLogs.length} recent server events`)

        let description = ''
        for (const eventLog of eventLogs) {
            description += this.client.events.formatEventLog(eventLog) + '\n'
        }

        embed.setDescription(description || 'No event logs found')

        return interaction.reply({ embeds: [embed], flags: ['Ephemeral'] })
    }

    private buildCasesEmbed(cases: any[], currentPage: number, totalPages: number, totalCases: number): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setTitle('📋 Recent Cases & Events')
            .setColor(Colors.Blurple)
            .setFooter({ text: `Page ${currentPage}/${totalPages} • ${totalCases} total cases • Use 'cases view <id>' for details` })

        let description = ''
        for (const caseData of cases) {
            if ('action' in caseData) {
                description += this.client.cases.formatCase(caseData) + '\n'
            } else {
                description += this.client.events.formatEventLog(caseData) + '\n'
            }
        }

        embed.setDescription(description || 'No cases found')
        return embed
    }

    private createPaginationRow(currentPage: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
        const row = new ActionRowBuilder<ButtonBuilder>()

        const buttons = [
            new ButtonBuilder()
                .setCustomId('cases-first')
                .setLabel('First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('cases-prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('cases-current')
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('cases-next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages),
            new ButtonBuilder()
                .setCustomId('cases-last')
                .setLabel('Last')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages)
        ]

        return row.addComponents(...buttons)
    }

    private setupPaginationCollector(message: Message | any, allCases: any[], totalPages: number) {
        let currentPage = 1

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: CasesCommand.COLLECTOR_TIME
        })

        collector.on('collect', async (interaction) => {
            const newPage = this.setNewPage(interaction.customId, currentPage, totalPages)
            if (newPage === currentPage) return interaction.deferUpdate()

            currentPage = newPage
            const [pageCases] = paginate(allCases, currentPage, CasesCommand.CASES_PER_PAGE)
            const embed = this.buildCasesEmbed(pageCases, currentPage, totalPages, allCases.length)
            const row = this.createPaginationRow(currentPage, totalPages)

            await interaction.update({ embeds: [embed], components: [row] })
        })

        collector.on('end', async () => {
            try {
                const disabledRow = this.createPaginationRow(currentPage, totalPages)
                disabledRow.components.forEach(button => button.setDisabled(true))

                const currentEmbed = await message.fetch().then((msg: any) => msg.embeds[0])
                await message.edit({ embeds: [currentEmbed], components: [disabledRow] })
            } catch {
            }
        })
    }

    private setNewPage(customId: string, currentPage: number, totalPages: number): number {
        switch (customId) {
            case 'cases-first': return 1
            case 'cases-prev': return Math.max(1, currentPage - 1)
            case 'cases-next': return Math.min(totalPages, currentPage + 1)
            case 'cases-last': return totalPages
            default: return currentPage
        }
    }

    public override registerApplicationCommands(registry: Subcommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('cases')
                .setDescription('View moderation cases and event logs')
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('recent')
                        .setDescription('Show recent cases and events with pagination')
                        .addIntegerOption((option) =>
                            option
                                .setName('limit')
                                .setDescription('Number of cases to fetch (1-100, default: 50)')
                                .setMinValue(1)
                                .setMaxValue(100)
                                .setRequired(false)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('view')
                        .setDescription('View specific case or event log by ID')
                        .addIntegerOption((option) =>
                            option
                                .setName('id')
                                .setDescription('Case or event log ID to view')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('user')
                        .setDescription('Show all cases and events for a specific user')
                        .addUserOption((option) =>
                            option
                                .setName('user')
                                .setDescription('User to view cases for')
                                .setRequired(true)
                        )
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('moderation')
                        .setDescription('Show only moderation cases (bans, kicks, etc)')
                )
                .addSubcommand((subcommand) =>
                    subcommand
                        .setName('events')
                        .setDescription('Show only server event logs')
                )
        )
    }
}