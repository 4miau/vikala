import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import type { Message } from 'discord.js'

@ApplyOptions<Command.Options>({
    name: 'clean',
    description: 'Cleans up bot messages from a channel.',
    usage: 'clean',
    runIn: ['GUILD_ANY'],
    requiredClientPermissions: ['ManageMessages'],
    requiredUserPermissions: ['ManageMessages']
})
export class Clean extends Command {
    client = this.container.client

    public async messageRun(message: Message) {
        if (!message.channel.isSendable()) return

        await message.channel.messages.fetch({ limit: 100, cache: true })
            .then(messages => messages.filter(m => m.author.bot))
            .then(filtered => filtered.forEach(m => m?.delete()))
            .catch(() => null)

        return message.channel.send('Cleaned up bot messages!')
            .then((m: Message) => { setTimeout(() => m.delete().catch(() => null), 3000) })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        if (!interaction.channel || !interaction.channel.isSendable()) return

        await interaction.channel.messages.fetch({ limit: 100, cache: true })
            .then(messages => messages.filter(m => m.author.bot))
            .then(filtered => filtered.forEach(m => m?.delete()))
            .catch(() => null)

        return interaction.reply({ content: 'Cleaned up bot messages!', flags: ['Ephemeral'] })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('clean')
                .setDescription('Cleans up bot messages from a channel.')
        )
    }
}