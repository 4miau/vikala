import { ApplyOptions } from '@sapphire/decorators'
import { Args, Command } from '@sapphire/framework'
import { EmbedBuilder, type Message } from 'discord.js'

@ApplyOptions<Command.Options>({
	name: 'gamedeals',
	aliases: ['deals'],
	description: 'Get the latest game deals from keyshops (from gg.deals)',
	detailedDescription:
		'Fetches the latest game deals for a specified Steam game ID from gg.deals, including prices from various keyshops. The default region is US, but you can specify other regions like EU for prices in EUR.',
	usage: 'gamedeals <gameid> [region]',
	examples: [
		{ example: 'gamedeals 570', description: 'Get the latest game deals for Dota 2 in USD.' },
		{ example: 'gamedeals 570 eu', description: 'Get the latest game deals for Dota 2 in the EU region (prices in EUR).' }
	]
})
export class GameDeals extends Command {
	private client = this.container.client

	public async messageRun(message: Message, args: Args) {
		if (!message.channel.isSendable()) return

		const gameId = await args.pickResult('string').then((res) => (res.isOk ? res.unwrap() : null))
		if (!gameId) return message.channel.send({ content: 'Provide a valid steam game ID.' })

		const region = await args.pick('string').catch(() => 'us')

		try {
			const game: GGDealsGameResponse = await this.client.tasks.get('ggdeals').exec(gameId, region)
			return message.channel.send({ embeds: [this.buildGameDealsEmbed(game)] })
		} catch {
			return message.channel.send({ content: 'There was an error fetching the game deals. Please try again later.' })
		}
	}

	public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		const gameId = interaction.options.getString('gameid', true)
		const region = interaction.options.getString('region') || 'us'

		try {
			const game: GGDealsGameResponse = await this.client.tasks.get('ggdeals').exec(gameId, region)
			return interaction.reply({ embeds: [this.buildGameDealsEmbed(game)] })
		} catch {
			return interaction.reply({ content: 'There was an error fetching the game deals. Please try again later.', flags: ['Ephemeral'] })
		}
	}

	private buildGameDealsEmbed(game: GGDealsGameResponse) {
		return new EmbedBuilder().setAuthor({ name: game.title, url: game.url }).setDescription(`
                **Current Retail Price**: ${game.prices.currency} ${game.prices.currentRetail}
                **Current Keyshops Price**: ${game.prices.currency} ${game.prices.currentKeyshops}
                **Historical Keyshops Low**: ${game.prices.currency} ${game.prices.historicalKeyshops}
            `)
	}

	// biome-ignore format
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('gamedeals')
				.setDescription('Get the latest game deals from keyshops (from gg.deals)')
				.addStringOption((option) =>
					option
						.setName('gameid')
						.setDescription('Steam game ID')
						.setRequired(true)
				)
				.addStringOption((option) =>
					option
						.setName('region')
						.setDescription('Region (e.g., us, eu)')
						.setRequired(false)
				)
		)
	}
}
