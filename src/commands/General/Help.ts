import { Args, Command, CommandOptions } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, InteractionResponse, type Message, ButtonStyle, ComponentType, TextChannel } from 'discord.js'
import ms from 'ms'

import { omitBy, paginate } from 'miau-utilities'
import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
    name: 'help',
    aliases: ['h'],
    description: 'Displays help information about the bot commands.',
    detailedDescription: 'Displays help information about the bot commands. You can also get detailed information about a specific command by providing its name as an argument.',
    usage: 'help [command]',
    examples: [
        { example: 'help', description: 'Displays a list of all commands.' },
        { example: 'help ping', description: 'Displays detailed information about the "ping" command.' }
    ]
})
export class Help extends Command {
    client = this.container.client
    private static readonly COMMANDS_PER_PAGE = 6
    private static readonly COLLECTOR_TIME = ms('5m')

    private getCommands(userId?: string): Command<Args, CommandOptions>[] {
        const commands = this.client.commandStore.map((cmd) => cmd)
        const isOwner = userId === this.client.owner

        if (isOwner) return commands as Command<Args, CommandOptions>[]
        return omitBy(commands, (cmd) => cmd.category === 'Owner' || cmd.category === 'Dev') as Command<Args, CommandOptions>[]
    }

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const cmdArgs = await args.restResult('string')
        const commandName = cmdArgs.isOk() ? cmdArgs.unwrap() : null

        return this.handleHelpRequest(commandName, message.author.id, (content) => (message.channel as TextChannel).send(content))
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const commandName = interaction.options.getString('command')

        return this.handleHelpRequest(commandName, interaction.user.id, (content) => interaction.reply(content))
    }

    private async handleHelpRequest(commandName: string | null, userId: string, sendFn: (content: any) => Promise<any>) {
        if (commandName) return this.sendCommandHelp(commandName, sendFn)
        return this.sendAllCommandsHelp(userId, sendFn)
    }

    private async sendCommandHelp(commandName: string, sendFn: (content: any) => Promise<any>) {
        try {
            const cmd = this.client.commandStore.resolve(commandName)
            const embed = this.buildCommandEmbed(cmd)
            return sendFn({ embeds: [embed] })
        } catch {
            return sendFn({ content: 'Command not found.', flags: ['Ephemeral'] })
        }
    }

    private async sendAllCommandsHelp(userId: string, sendFn: (content: any) => Promise<any>) {
        const commands = this.getCommands(userId)
        const [firstPageCommands, totalPages] = paginate(commands, 1, Help.COMMANDS_PER_PAGE)

        const embed = this.buildAllCommandsEmbed(firstPageCommands)
        const row = this.createPaginationRow(1, totalPages)

        const message = await sendFn({ embeds: [embed], components: [row] })

        if (totalPages > 1) {
            this.setupPaginationCollector(message, commands, totalPages)
        }
    }

    private buildCommandEmbed(command: Command) {
        const embed = new EmbedBuilder()
            .setTitle(command.options.usage || command.name)
            .setDescription(command.detailedDescription?.toString() || command.options.description)
            .setColor(Colors.Green)

        command.options?.examples?.forEach((ex) => {
            embed.addFields({ name: ex.example, value: ex.description })
        })

        return embed
    }

    private buildAllCommandsEmbed(commands: Command[]) {
        const embed = new EmbedBuilder()
            .setTitle('Help')
            .setDescription(
                `**SOME HELPFUL LINKS**\n` +
                `[Invite Me](https://discord.com/oauth2/authorize?client_id=1429899304793014323&permissions=8)\n` +
                `[Miau's Server!](https://discord.gg/Dgn3ta6dA3)`
            )
            .setColor(Colors.Green)

        commands.forEach((cmd) => { embed.addFields({ name: cmd.name, value: cmd.description }) })

        return embed
    }

    private createPaginationRow(currentPage: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
        const row = new ActionRowBuilder<ButtonBuilder>()

        const buttons = [
            new ButtonBuilder()
                .setCustomId('help-first')
                .setLabel('First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('help-prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('help-current')
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('help-next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages),
            new ButtonBuilder()
                .setCustomId('help-last')
                .setLabel('Last')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages)
        ]

        return row.addComponents(...buttons)
    }

    private setupPaginationCollector(message: Message, commands: Command[], totalPages: number) {
        let currentPage = 1

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: Help.COLLECTOR_TIME
        })

        collector.on('collect', async (interaction) => {
            const newPage = this.setNewPage(interaction.customId, currentPage, totalPages)
            if (newPage === currentPage) return interaction.deferUpdate()

            currentPage = newPage
            const [pageCommands] = paginate(commands, currentPage, Help.COMMANDS_PER_PAGE)
            const embed = this.buildAllCommandsEmbed(pageCommands)
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
            case 'help-first': return 1
            case 'help-prev': return Math.max(1, currentPage - 1)
            case 'help-next': return Math.min(totalPages, currentPage + 1)
            case 'help-last': return totalPages
            default: return currentPage
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('help')
                .setDescription('Displays help information about the bot commands.')
                .addStringOption((option) =>
                    option
                        .setName('command')
                        .setDescription('The command to get help for.')
                        .setRequired(false)
                )
        )
    }
}