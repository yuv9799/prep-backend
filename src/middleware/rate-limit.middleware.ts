import rateLimit, { type Options } from 'express-rate-limit'
import type { Request } from 'express'
import { env } from '../config/env'

function keyGenerator(req: Request): string {
  // Prefer the authenticated user id so the limit applies per account; fall
  // back to the IP for unauthenticated endpoints such as login.
  const userId = req.user?.id
  if (userId) return `u:${userId}`
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
  return `ip:${ip}`
}

function baseOptions(max: number): Partial<Options> {
  return {
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    message: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMITED',
    },
    // Disabled in tests so suites are not order-dependent; covered explicitly
    // by a dedicated rate-limit test that re-enables it.
    skip: () => env.NODE_ENV === 'test' && process.env.RATE_LIMIT_ENABLED !== 'true',
  }
}

/** Broad limiter applied to the whole API surface. */
export const globalLimiter = rateLimit(baseOptions(env.RATE_LIMIT_MAX))

/** Stricter limiter for credential-based endpoints. */
export const authLimiter = rateLimit(baseOptions(env.AUTH_RATE_LIMIT_MAX))

/** Very strict limiter for password reset / verification token endpoints. */
export const sensitiveLimiter = rateLimit(baseOptions(5))
