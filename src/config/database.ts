import mongoose from 'mongoose'
import { env, isTest } from './env'
import { logger } from './logger'

mongoose.set('strictQuery', true)
// Fail fast instead of buffering commands for 10s when Mongo is unreachable.
mongoose.set('bufferCommands', false)

export async function connectDatabase(uri: string = env.MONGODB_URI): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose

  mongoose.connection.on('error', (err) => {
    logger.error({ err }, 'MongoDB connection error')
  })
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected')
  })

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !isTest,
  })

  logger.info({ db: mongoose.connection.name }, 'MongoDB connected')
  return mongoose
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return
  await mongoose.disconnect()
  logger.info('MongoDB disconnected')
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1
}
