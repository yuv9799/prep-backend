import { Router, type NextFunction, type Request, type Response } from 'express'
import { User } from '../models/user.model'
import { unauthorized } from '../utils/errors'
import { cookieNames } from '../utils/cookies'
import { verifyAccessToken } from '../services/token.service'

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim() || null
  }
  const cookie = (req.cookies as Record<string, string> | undefined)?.[cookieNames.access]
  return cookie ?? null
}

/**
 * Resolves the caller from the access cookie or bearer token. When a token is
 * present but invalid the request is rejected outright — we never fall through
 * to anonymous access on a protected route.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractToken(req)
    if (!token) throw unauthorized('Authentication required')

    let payload
    try {
      payload = verifyAccessToken(token)
    } catch {
      throw unauthorized('Invalid or expired session')
    }

    // Confirm the account is still active; a deactivated account must not be
    // able to keep using an unexpired access token.
    const user = await User.findById(payload.sub)
      .select('_id email role accountStatus')
      .lean()

    if (!user) throw unauthorized('Account no longer exists')
    if (user.accountStatus !== 'active') {
      throw unauthorized('Account is not active')
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
    }
    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Attaches the caller when a valid token is present but never rejects.
 * Used by endpoints whose response differs for signed-in users.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req)
  if (!token) return next()
  try {
    const payload = verifyAccessToken(token)
    req.user = { id: payload.sub, email: payload.email, role: payload.role }
  } catch {
    // ignore
  }
  next()
}

/**
 * Determines whether one of the router's own routes matches the request path.
 *
 * `router.use(requireAuth)` would otherwise run for *every* path below the
 * mount point, so an unknown URL would answer 401 instead of 404. Only the
 * route layers are considered; `use` layers are ignored on purpose.
 */
function routerHasMatchingRoute(router: Router, path: string): boolean {
  const stack = (router as unknown as { stack?: RouterLayer[] }).stack ?? []

  for (const layer of stack) {
    if (!layer.route) continue
    try {
      if (layer.match(path)) return true
    } catch {
      // A malformed URI will be rejected by Express later on; treat it as a
      // match so the request is not mistaken for an unknown route.
      return true
    }
  }
  return false
}

interface RouterLayer {
  route?: unknown
  match(path: string): boolean
}

/**
 * Installs the authentication gate on a router.
 *
 * The gate authenticates only when the request actually addresses one of the
 * router's routes, so unknown paths still reach the 404 handler.
 */
export function authGate(router: Router): void {
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!routerHasMatchingRoute(router, req.path)) return next()
    return requireAuth(req, res, next)
  })
}
