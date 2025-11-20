import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, User } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.UserUpdate
})
export class EventListener extends Listener {
    client = this.container.client

    public override async run(oldUser: User, newUser: User) {
        const guilds = this.client.guilds.cache.filter(guild => guild.members.cache.has(newUser.id))
        
        for (const guild of guilds.values()) {
            await this.client.events.userUpdatedLog(guild, oldUser, newUser)
        }
    }
}