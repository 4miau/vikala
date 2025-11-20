import { Listener } from '@sapphire/framework'
import { ApplyOptions } from '@sapphire/decorators'
import { Events, GuildMember } from 'discord.js'

@ApplyOptions<Listener.Options>({
    event: Events.GuildMemberRemove
})
export class EventListener extends Listener {
    private client = this.container.client

    public override async run(member: GuildMember) {
        await this.client.events.memberLeftLog(member.guild, member.user.username, member.user.id)
        await this.client.welcome.handleGoodbye(member)
    }
}