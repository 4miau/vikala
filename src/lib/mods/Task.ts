import { Piece } from '@sapphire/framework'

export default abstract class Task extends Piece {
	abstract exec(..._: any): any
}
