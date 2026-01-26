import { ApplyOptions } from '@sapphire/decorators'
import { Listener, Events } from '@sapphire/framework'

@ApplyOptions<Listener.Options>({ once: true, event: Events.ClientReady })
export class EventListener extends Listener {
	private client = this.container.client

	public override run() {
		this.client.logger.info('Bot has started successfully!')
		this.client.presences.setInitialPresence()
	}
}
