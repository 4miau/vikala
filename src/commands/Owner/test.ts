import { Args, Command } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActionRow, ComponentType } from 'discord.js'
import ms from 'ms'

@ApplyOptions<Command.Options>({
    name: 'test',
    aliases: [],
    description: 'Where I test my coding bullshit',
    preconditions: ['OwnerOnly']
})
export class Test extends Command {
    client = this.container.client

    public async messageRun(message: Message, args: Args) {
        if (!message.channel.isSendable()) return

        console.log(
            this.client.commandStore.map(cmd =>
                `Name: ${cmd.name}\n` +
                `Category: ${cmd.category}\n` +
                `SubCategory: ${cmd.subCategory}\n` +
                `FullCategory: ${cmd.fullCategory}\n` +
                `ParentCategory: ${cmd.parentCategory}\n` +
                `Description: ${cmd.description}\n` +
                `DetailedDescription: ${cmd.detailedDescription}`
            ).join('\n\n')
        )
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const button = new ButtonBuilder()
            .setCustomId('id-1')
            .setLabel('Click Me')
            .setEmoji('🎉')
            .setStyle(ButtonStyle.Primary)

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(button)

        const msg = await interaction.channel.send({
            content: 'Loading...',
            components: [ actionRow ]
        })

        msg.createMessageComponentCollector({ time: ms('30s') })
            .on('collect', async (interaction) => {
                return 'success'
            })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName('test')
                .setDescription('Where I test my coding bullshit')
        )
    }
}