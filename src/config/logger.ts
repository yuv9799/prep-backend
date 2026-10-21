import pino from 'pino'
import { env, isProduction } from './env'

/**
 * Structured logger. Never logs request bodies or authorization headers — the
 * redact list covers the most common accidental secret leaks.
 */
export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'currentPassword',
      'newPassword',
      'token',
      'refreshToken',
      'accessToken',
      'resetToken',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[redacted]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },
})

export const loggerMeta = { service: 'prepforge-backend', env: env.NODE_ENV }
