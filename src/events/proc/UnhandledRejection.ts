import { Listener } from '@sapphire/framework'

export default class UnhandledRejection extends Listener {
    public constructor(ctx: Listener.LoaderContext) {
        super(ctx, {
            name: 'unhandledRejection'
        })
    }

    public override run(err: Error) {
        const container = this.container

        container.logger.fatal('ERROR', `Unhandled Rejection: ${err.stack}`)
        process.exit(1)
    }
}