import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env'
import { forbidden } from '../utils/errors'

/**
 * Methods that do not change state and therefore do not need CSRF protection.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Origin/Referer based CSRF protection for cookie-authenticated requests.
 *
 * The frontend sends `credentials: include` but no custom header, so a
 * double-submit token would require frontend changes. Instead we verify that
 * the request originates from the configured client origin. Combined with
 * `SameSite=strict` cookies this blocks cross-site state-changing requests.
 *
 * Requests that carry a `Authorization: Bearer` header are exempt: bearer
 * tokens are not attached automatically by the browser, so they are not
 * vulnerable to ambient CSRF.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next()

  const authorization = req.headers.authorization
  if (authorization && authorization.startsWith('Bearer ')) return next()

  const origin = req.headers.origin
  const referer = req.headers.referer

  const allowedOrigins = new Set(
    env.CLIENT_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  )

  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return next(forbidden('Request blocked: untrusted origin'))
    }
    return next()
  }

  // No Origin header (e.g. some same-origin non-CORS requests). Fall back to
  // Referer, and if neither is present treat it as a non-browser client.
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (!allowedOrigins.has(refererOrigin)) {
        return next(forbidden('Request blocked: untrusted referer'))
      }
      return next()
    } catch {
      return next(forbidden('Request blocked: malformed referer'))
    }
  }

  next()
}
