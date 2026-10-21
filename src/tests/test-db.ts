import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/database'

let mongod: MongoMemoryServer | null = null

/**
 * Boots an in-memory MongoDB and connects Mongoose to it.
 * The returned URI is used for the rest of the test file.
 */
export async function startTestDatabase(): Promise<string> {
  mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
  })
  const uri = mongod.getUri()
  await connectDatabase(uri)
  return uri
}

/** Drops all collections so each test starts from a known state. */
export async function clearDatabase(): Promise<void> {
  const collections = await mongoose.connection.db?.collections()
  if (!collections) return
  for (const collection of collections) {
    await collection.deleteMany({})
  }
}

/** Stops the in-memory server and disconnects Mongoose. */
export async function stopTestDatabase(): Promise<void> {
  await disconnectDatabase()
  if (mongod) {
    await mongod.stop()
    mongod = null
  }
}
