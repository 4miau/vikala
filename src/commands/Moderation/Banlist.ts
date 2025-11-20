import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, type Message } from 'discord.js'
import { paginate } from 'miau-utilities'

@ApplyOptions<Command.Options>({
    name: 'bans',
    aliases: ['banlist'],
    description: 'Gets the current bans for the server.',
    usage: 'bans [page]',
    examples: [
        { example: 'bans', description: 'Gets the first page of bans for the server.' },
        { example: 'bans 2', description: 'Gets the second page of bans for the server.' }
    ],
    runIn: 'GUILD_ANY',
    requiredUserPermissions: ['ViewAuditLog']
})
export class Bans extends Command {
    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const page = (await args.pickResult('number')).unwrapOr(1)
        const bans = await message.guild.bans.fetch().then(collection => collection.map(ban => ban))
        const filteredBans = paginate(bans, page, 10)

        const e = new EmbedBuilder()
            .setAuthor({ name: `${message.guild.name} | Bans`, iconURL: message.guild.iconURL() })
            .setFooter({ text: `Page ${page > filteredBans[1] ? bans[1] : page } of ${filteredBans[1]}` })

        if (!bans.length) e.setDescription('')
        else e.setDescription('') //TODO: Complete banlist embed from abby

        return message.channel.send({ embeds: [e] })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        await interaction.deferReply()

        const page = interaction.options.getNumber('page') || 1
        const bans = await interaction.guild.bans.fetch().then(collection => collection.map(ban => ban))
        const filtered = paginate(bans, page, 10)

        const e = new EmbedBuilder()
            .setAuthor({ name: `${interaction.guild.name} | Bans`, iconURL: interaction.guild.iconURL() })
            .setFooter({ text: `Page ${page > filtered[1] ? bans[1] : page } of ${filtered[1]}` })

        return interaction.editReply({ embeds: [e] })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('bans')
                .setDescription('Gets the current bans for the server.')
                .addNumberOption((option) => {
                    return option
                        .setName('page')
                        .setDescription('The page to view.')
                        .setRequired(false)
                })
        )
    }
}