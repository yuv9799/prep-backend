/**
 * Global test setup. Points the app at an in-memory MongoDB instance and
 * provides a clean database between test files.
 *
 * The environment must be configured before `config/env` is imported, so the
 * variables are set here at the very top of the file.
 */
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/prepforge-test'
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters-long'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.EMAIL_LOG_ONLY = 'true'
process.env.RATE_LIMIT_ENABLED = 'false'

export {}
