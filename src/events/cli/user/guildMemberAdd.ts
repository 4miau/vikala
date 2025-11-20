import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildMember } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.GuildMemberAdd
})
export class EventListener extends Listener {
    private client = this.container.client

    public override async run(member: GuildMember) {
        await this.client.events.memberJoinedLog(member.guild, member.user.username, member.user.id)
        await this.client.welcome.handleWelcome(member)
        await this.client.autoroles.handleMemberJoin(member)
    }
}