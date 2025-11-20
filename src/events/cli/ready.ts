import { ApplyOptions } from '@sapphire/decorators'
import { Listener, Events } from '@sapphire/framework'

@ApplyOptions<Listener.Options>({ once: true, event: Events.ClientReady })
export class EventListener extends Listener {
    public override run() {
        const { client } = this.container

        client.logger.info('Bot has started successfully!')
        
        client.presences.setInitialPresence()
    }
}