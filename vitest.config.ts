import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    // The in-memory MongoDB server needs a moment to download/start.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Each test file gets its own database, so files may run in parallel.
    fileParallelism: false,
    pool: 'forks',
  },
})
