import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, Guild, type Message } from 'discord.js'

@ApplyOptions<Command.Options>({
    name: 'membercount',
    aliases: ['members'],
    description: 'Get the member count of the server',
    detailedDescription: 'Get the member count of the server, including total members, online members, humans, and bots.',
    usage: 'membercount',
    examples: [
        { example: 'membercount', description: 'Will return the total number of members, online, humans & bots in the server.' },
    ]
})
export class MemberCount extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        const e = this.buildMemberCountEmbed(message.guild)
        await message.channel.send({ embeds: [e] })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const e = this.buildMemberCountEmbed(interaction.guild)
        await interaction.reply({ embeds: [e], flags: ['Ephemeral'] })
    }

    private buildMemberCountEmbed(guild: Guild) {
        return new EmbedBuilder()
            .setTitle(`Member Count | ${guild.memberCount}`)
            .addFields(
                { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Online', value: `${guild.members.cache.filter(m => m.presence?.status !== 'invisible' && m.presence?.status !== 'offline').size}`, inline: true },
                { name: 'Humans', value: `${guild.members.cache.filter(m => !m.user.bot).size}`, inline: true },
                { name: 'Bots', value: `${guild.members.cache.filter(m => m.user.bot).size}`, inline: true }
            )
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('membercount')
                .setDescription('Get the member count of the server')
        )
    }
}