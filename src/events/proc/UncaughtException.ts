import { Listener } from '@sapphire/framework'

export default class UncaughtException extends Listener {
    public constructor(ctx: Listener.LoaderContext) {
        super(ctx, {
            name: 'uncaughtException',
        })
    }

    public override run(err: Error) {
        const container = this.container

        container.logger.fatal('ERROR', `Uncaught Exception: ${err.stack}`)
        process.exit(1)
    }
}