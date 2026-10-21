import crypto from 'node:crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env'

export interface AccessTokenPayload extends JwtPayload {
  sub: string
  email: string
  type: 'access'
  role: string
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string
  jti: string
  type: 'refresh'
}

/** Signs a short-lived access token. */
export function signAccessToken(user: { id: string; email: string; role: string }): string {
  return jwt.sign(
    { email: user.email, type: 'access', role: user.role },
    env.JWT_ACCESS_SECRET,
    { subject: user.id, expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'] },
  )
}

/**
 * Creates a refresh token. The raw token is returned to the caller (and only
 * the caller); the database stores its SHA-256 hash.
 */
export function signRefreshToken(userId: string): { token: string; tokenHash: string; jti: string } {
  const jti = crypto.randomUUID()
  const token = jwt.sign({ type: 'refresh', jti }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  })
  return { token, tokenHash: hashToken(token), jti }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET)
  if (typeof payload === 'string' || payload.type !== 'access') {
    throw new Error('Invalid access token')
  }
  return payload as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET)
  if (typeof payload === 'string' || payload.type !== 'refresh') {
    throw new Error('Invalid refresh token')
  }
  return payload as RefreshTokenPayload
}

/** SHA-256 of a token, used to look up stored refresh/reset tokens. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Cryptographically random, URL-safe opaque token for email flows. */
export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}
