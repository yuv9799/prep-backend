/**
 * Downloads the mongod binary used by the in-memory MongoDB server.
 * Run once before the test suite: `npm run db:download`.
 */
import { MongoBinary } from 'mongodb-memory-server-core'

async function main(): Promise<void> {
  console.log('Downloading MongoDB binary (this can take several minutes)...')
  const path = await MongoBinary.getPath({ version: '7.0.14' })
  console.log(`MongoDB binary ready at: ${path}`)
}

main().catch((error) => {
  console.error('Failed to download MongoDB binary:', error)
  process.exit(1)
})
