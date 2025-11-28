import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, type Message, ButtonStyle, ComponentType, GuildBan } from 'discord.js'
import { arrayEmpty, paginate } from 'miau-utilities'
import ms from 'ms'

import { Colors } from '../../lib/util/Colors'

@ApplyOptions<Command.Options>({
    name: 'bans',
    aliases: ['banlist'],
    description: 'Display a paginated list of all banned users in the server.',
    detailedDescription: 'View all currently banned users with their usernames, IDs, and ban reasons. Navigate through pages using interactive buttons.',
    usage: 'bans',
    examples: [
        { example: 'bans', description: 'Display the ban list with interactive pagination.' }
    ],
    runIn: 'GUILD_ANY',
    requiredUserPermissions: ['BanMembers', 'ViewAuditLog'],
    requiredClientPermissions: ['BanMembers']
})
export class Bans extends Command {
    private static readonly BANS_PER_PAGE = 10
    private static readonly COLLECTOR_TIME = ms('5m')

    public async messageRun(message: Message) {
        if (!message.channel.isSendable()) return

        const bans = await message.guild.bans.fetch().then(collection => collection.map(ban => ban))

        if (arrayEmpty(bans)) return message.channel.send('✅ No banned users found in this server.')

        const [firstPageBans, totalPages] = paginate(bans, 1, Bans.BANS_PER_PAGE)
        const embed = this.buildBansEmbed(firstPageBans, 1, totalPages, bans.length, message.guild.name, message.guild.iconURL())
        const row = this.createPaginationRow(1, totalPages)

        const response = await message.channel.send({ embeds: [embed], components: totalPages > 1 ? [row] : [] })
        if (totalPages > 1) this.setupPaginationCollector(response, bans, totalPages, message.guild.name, message.guild.iconURL())
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply()

        const bans = await interaction.guild.bans.fetch().then(collection => collection.map(ban => ban))
        if (arrayEmpty(bans)) return interaction.editReply('✅ No banned users found in this server.')

        const [firstPageBans, totalPages] = paginate(bans, 1, Bans.BANS_PER_PAGE)
        const embed = this.buildBansEmbed(firstPageBans, 1, totalPages, bans.length, interaction.guild.name, interaction.guild.iconURL())
        const row = this.createPaginationRow(1, totalPages)

        const response = await interaction.editReply({ embeds: [embed], components: totalPages > 1 ? [row] : [] })
        if (totalPages > 1) this.setupPaginationCollector(response, bans, totalPages, interaction.guild.name, interaction.guild.iconURL())
    }

    private buildBansEmbed(bans: GuildBan[], currentPage: number, totalPages: number, totalBans: number, guildName: string, guildIcon: string | null): EmbedBuilder {
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setAuthor({ name: `${guildName} | Ban List`, iconURL: guildIcon || undefined })
            .setFooter({ text: `Page ${currentPage}/${totalPages} • Total Bans: ${totalBans}` })
            .setTimestamp()

        let description = ''

        for (const ban of bans) {
            const reason = ban.reason || 'No reason provided'
            const formattedReason = reason.length > 50 ? reason.substring(0, 47) + '...' : reason

            description += `🔨 **${ban.user.tag}** (\`${ban.user.id}\`)\n`
            description += `└ *${formattedReason}*\n\n`
        }

        embed.setDescription(description.trim() || 'No bans found')
        return embed
    }

    private createPaginationRow(currentPage: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
        const row = new ActionRowBuilder<ButtonBuilder>()

        const buttons = [
            new ButtonBuilder()
                .setCustomId('bans-first')
                .setLabel('First')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('bans-prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId('bans-current')
                .setLabel(`${currentPage}/${totalPages}`)
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('bans-next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages),
            new ButtonBuilder()
                .setCustomId('bans-last')
                .setLabel('Last')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages)
        ]

        return row.addComponents(...buttons)
    }

    private setupPaginationCollector(message: Message, allBans: GuildBan[], totalPages: number, guildName: string, guildIcon: string | null) {
        let currentPage = 1

        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: Bans.COLLECTOR_TIME
        })

        collector.on('collect', async (interaction) => {
            const newPage = this.setNewPage(interaction.customId, currentPage, totalPages)
            if (newPage === currentPage) return interaction.deferUpdate()

            currentPage = newPage
            const [pageBans] = paginate(allBans, currentPage, Bans.BANS_PER_PAGE)
            const embed = this.buildBansEmbed(pageBans, currentPage, totalPages, allBans.length, guildName, guildIcon)
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
            case 'bans-first': return 1
            case 'bans-prev': return Math.max(1, currentPage - 1)
            case 'bans-next': return Math.min(totalPages, currentPage + 1)
            case 'bans-last': return totalPages
            default: return currentPage
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('bans')
                .setDescription('Display a paginated list of all banned users in the server.')
        )
    }
}