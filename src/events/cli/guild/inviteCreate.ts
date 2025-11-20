import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, Invite, Guild } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.InviteCreate
})
export class EventListener extends Listener {
    client = this.container.client

    public override async run(invite: Invite) {
        if (!invite.guild) return
        await this.client.events.inviteCreatedLog(invite.guild as Guild, invite.code)
    }
}