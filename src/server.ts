import type { Server } from 'node:http'
import { createApp } from './app'
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from './config/database'
import { env } from './config/env'
import { logger } from './config/logger'

async function bootstrap(): Promise<void> {
  await connectDatabase()

  const app = createApp()
  const server: Server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'PrepForge API listening')
  })

  server.on('error', (error) => {
    logger.error({ err: error }, 'HTTP server error')
    process.exit(1)
  })

  let shuttingDown = false

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'Shutting down gracefully')

    // Stop accepting new connections, then release the database.
    server.close(async () => {
      try {
        await disconnectDatabase()
        logger.info('Shutdown complete')
        process.exit(0)
      } catch (error) {
        logger.error({ err: error }, 'Error during shutdown')
        process.exit(1)
      }
    })

    // Force exit if connections hang.
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000).unref()
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled promise rejection')
  })

  process.on('uncaughtException', (error) => {
    logger.error({ err: error }, 'Uncaught exception — exiting')
    void shutdown('uncaughtException')
  })
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to start server')
  process.exit(1)
})

export { isDatabaseConnected }
