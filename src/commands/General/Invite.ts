import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { EmbedBuilder, OAuth2Scopes, type Message } from 'discord.js'

@ApplyOptions<Command.Options>({
    name: 'invite',
    aliases: [],
    description: 'Sends an invite link for the bot.',
    usage: 'invite'
})
export class Invite extends Command {
    client = this.container.client

    public async messageRun(message: Message) {
        if (!message.channel.isSendable()) return

        const inviteLink = this.client.generateInvite({ permissions: 'Administrator', scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands] })

        const e = new EmbedBuilder()
            .setTitle('Invite Me')
            .setDescription(`[Invite me to your server](${inviteLink})`)

        return message.channel.send({ embeds: [e] })
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const inviteLink = this.client.generateInvite({ permissions: 'Administrator', scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands] })

        const e = new EmbedBuilder()
            .setTitle('Invite Me')
            .setDescription(`[Invite me to your server](${inviteLink})`)

        return interaction.reply({ embeds: [e], flags: ['Ephemeral'] })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('invite')
                .setDescription('Sends an invite link for the bot.')
        )
    }
}