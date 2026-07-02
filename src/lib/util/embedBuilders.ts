import { type ColorResolvable, EmbedBuilder } from 'discord.js'

/**
 * Creates a standardized embed for animal picture commands
 * @param title - The title of the embed (e.g., "🐱 Random Cat")
 * @param imageUrl - The URL of the animal image
 * @param color - The color of the embed
 * @returns EmbedBuilder instance
 */
export function createAnimalEmbed(title: string, imageUrl: string, color: ColorResolvable): EmbedBuilder {
	return new EmbedBuilder().setTitle(title).setImage(imageUrl).setColor(color)
}
