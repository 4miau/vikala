import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Role } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.GuildRoleDelete
})
export class EventListener extends Listener {
    client = this.container.client

    public override async run(role: Role) {
        await this.client.events.roleDeletedLog(role.guild, role.name)
    }
}