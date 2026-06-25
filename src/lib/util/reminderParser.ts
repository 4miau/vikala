import * as chrono from 'chrono-node'
import ms from 'ms'

export interface ParsedReminder {
	triggerAt: Date
	message: string
}

export function parseReminderInput(input: string): ParsedReminder | null {
	const now = new Date()

	// Try chrono-node first — no timezone option needed; Docker/server runs UTC by default
	const results = chrono.parse(input, now)

	if (results.length > 0) {
		const result = results[0]
		const triggerAt = result.start.date()

		if (triggerAt <= now) return null

		const before = input.slice(0, result.index).trim()
		const after = input.slice(result.index + result.text.length).trim()
		const message = [before, after].filter(Boolean).join(' ').trim()

		if (!message) return null

		return { triggerAt, message }
	}

	// Fall back to ms() for bare durations like "2d", "3h", "30m"
	const spaceIndex = input.search(/\s/)
	if (spaceIndex === -1) return null

	const durationToken = input.slice(0, spaceIndex)
	const duration = Number(ms(durationToken as any))

	if (typeof duration === 'number' && duration > 0) {
		const message = input.slice(spaceIndex).trim()
		if (!message) return null
		return { triggerAt: new Date(Date.now() + duration), message }
	}

	return null
}
