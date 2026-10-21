import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import { env } from '../config/env'
import { User, type UserDocument } from '../models/user.model'
import { RefreshToken } from '../models/refresh-token.model'
import { hashPassword, verifyPassword, getDummyHash, needsRehash } from './password.service'
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './token.service'
import { sendEmail } from './email.service'
import { logger } from '../config/logger'
import { conflict, forbidden, unauthorized } from '../utils/errors'
import { setAccessCookie, setCsrfCookie, setRefreshCookie } from '../utils/cookies'

/** Shape returned to the client for the authenticated user. */
export interface PublicUser {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  targetRole: string | null
  targetCompanies: string[]
  graduationYear: number | null
  createdAt: string
  emailVerified: boolean
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    avatarUrl: user.profile?.avatarUrl ?? null,
    targetRole: user.profile?.targetRole ?? null,
    targetCompanies: user.profile?.targetCompanies ?? [],
    graduationYear: user.profile?.graduationYear ?? null,
    createdAt: new Date(user.createdAt as unknown as string).toISOString(),
    emailVerified: user.emailVerified,
  }
}

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
}

/** Issues an access/refresh token pair and persists the refresh token hash. */
export async function issueTokens(user: UserDocument, req: Request): Promise<IssuedTokens> {
  const accessToken = signAccessToken({
    id: String(user._id),
    email: user.email,
    role: user.role,
  })
  const { token: refreshToken, tokenHash } = signRefreshToken(String(user._id))

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    userAgent: req.headers['user-agent']?.slice(0, 255) ?? null,
    ip: req.ip ?? null,
  })

  return { accessToken, refreshToken }
}

/** Writes the auth cookies onto the response. */
export function attachAuthCookies(res: Response, tokens: IssuedTokens): void {
  setAccessCookie(res, tokens.accessToken)
  setRefreshCookie(res, tokens.refreshToken)
  setCsrfCookie(res, generateOpaqueToken(16))
}


/**
 * Registers a new user. Duplicate emails raise a conflict.
 */
export async function registerUser(payload: {
  name: string
  email: string
  password: string
  targetRole?: string
  targetCompanies?: string[]
  graduationYear?: number
}): Promise<UserDocument> {
  const existing = await User.findOne({ email: payload.email }).lean()
  if (existing) throw conflict('An account with that email already exists')

  const passwordHash = await hashPassword(payload.password)

  const user = new User({
    name: payload.name,
    email: payload.email,
    passwordHash,
    emailVerified: false,
    profile: {
      targetRole: payload.targetRole ?? null,
      targetCompanies: payload.targetCompanies ?? [],
      graduationYear: payload.graduationYear ?? null,
    },
  })

  await user.save()
  logger.info({ userId: String(user._id) }, 'User registered')
  return user
}

/**
 * Validates credentials. Unknown emails and wrong passwords produce the same
 * error, and the password check runs even for unknown users so the response
 * time does not reveal whether the account exists.
 */
export async function authenticateUser(email: string, password: string): Promise<UserDocument> {
  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user) {
    await verifyPassword(password, await getDummyHash())
    throw unauthorized('Invalid email or password')
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw unauthorized('Invalid email or password')

  if (user.accountStatus === 'deactivated') {
    throw forbidden('This account is deactivated. Reactivate it to continue.')
  }
  if (user.accountStatus === 'deleted') {
    throw unauthorized('Invalid email or password')
  }

  // Transparently upgrade the hash if the parameters have changed.
  if (await needsRehash(user.passwordHash)) {
    user.passwordHash = await hashPassword(password)
    await user.save()
  }

  user.lastLoginAt = new Date()
  await user.save()

  return user
}


/**
 * Rotates a refresh token: the presented token is revoked and a new pair is
 * issued. Re-use of an already-rotated token revokes the whole chain.
 */
export async function rotateRefreshToken(
  token: string,
  req: Request,
): Promise<{ user: UserDocument; tokens: IssuedTokens }> {
  let payload
  try {
    payload = verifyRefreshToken(token)
  } catch {
    throw unauthorized('Invalid or expired session')
  }

  const tokenHash = hashToken(token)
  const stored = await RefreshToken.findOne({ tokenHash })

  if (!stored) throw unauthorized('Invalid or expired session')

  if (stored.revokedAt) {
    // Token reuse: revoke every session for this user as a precaution.
    await RefreshToken.updateMany(
      { userId: stored.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    )
    logger.warn({ userId: String(stored.userId) }, 'Refresh token reuse detected')
    throw unauthorized('Invalid or expired session')
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw unauthorized('Invalid or expired session')
  }

  const user = await User.findById(stored.userId)
  if (!user || user.accountStatus !== 'active') {
    throw unauthorized('Invalid or expired session')
  }

  stored.revokedAt = new Date()
  await stored.save()

  const tokens = await issueTokens(user, req)
  const replacement = await RefreshToken.findOne({ tokenHash: hashToken(tokens.refreshToken) })
  if (replacement) {
    replacement.replacedByTokenHash = hashToken(tokens.refreshToken)
    await replacement.save()
  }

  return { user, tokens }
}

/** Revokes all refresh tokens for a user (logout-everywhere, password change). */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  )
}


/**
 * Starts a password reset. The response is always identical so an attacker
 * cannot discover which emails are registered.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await User.findOne({ email, accountStatus: 'active' })
  if (!user) {
    logger.info({ email }, 'Password reset requested for unknown email')
    return
  }

  const token = generateOpaqueToken()
  user.passwordResetTokenHash = hashToken(token)
  user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await user.save()

  await sendEmail({
    to: user.email,
    subject: 'Reset your PrepForge password',
    text: [
      'A password reset was requested for your PrepForge account.',
      '',
      `Reset link: ${env.CLIENT_ORIGIN}/reset-password?token=${token}`,
      '',
      'This link expires in 30 minutes and can only be used once.',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
  })

  logger.info({ userId: String(user._id) }, 'Password reset token issued')
}

/**
 * Completes a password reset using a single-use, expiring token.
 */
export async function resetPassword(token: string, newPassword: string): Promise<UserDocument> {
  const tokenHash = hashToken(token)
  const user = await User.findOne({ passwordResetTokenHash: tokenHash })

  if (!user) throw unauthorized('This reset link is invalid or has already been used')

  if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() <= Date.now()) {
    user.passwordResetTokenHash = null
    user.passwordResetExpiresAt = null
    await user.save()
    throw unauthorized('This reset link has expired')
  }

  user.passwordHash = await hashPassword(newPassword)
  // Single use: clear the token so it cannot be replayed.
  user.passwordResetTokenHash = null
  user.passwordResetExpiresAt = null
  await user.save()

  // A password change invalidates all existing sessions.
  await revokeAllRefreshTokens(String(user._id))

  logger.info({ userId: String(user._id) }, 'Password reset completed')
  return user
}

/**
 * Changes the password of an authenticated user after verifying the current one.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<UserDocument> {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user) throw unauthorized('Account no longer exists')

  const valid = await verifyPassword(currentPassword, user.passwordHash)
  if (!valid) throw unauthorized('Current password is incorrect')

  user.passwordHash = await hashPassword(newPassword)
  await user.save()

  await revokeAllRefreshTokens(userId)
  logger.info({ userId }, 'Password changed')
  return user
}

/** Issues an email-verification token. */
export async function issueEmailVerification(user: UserDocument): Promise<string> {
  const token = generateOpaqueToken()
  user.emailVerificationTokenHash = hashToken(token)
  user.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await user.save()

  await sendEmail({
    to: user.email,
    subject: 'Verify your PrepForge email',
    text: [
      'Welcome to PrepForge. Confirm your email address to activate your account.',
      '',
      `Verification link: ${env.CLIENT_ORIGIN}/verify-email?token=${token}`,
      '',
      'This link expires in 24 hours.',
    ].join('\n'),
  })

  return token
}

/** Confirms an email address using a single-use token. */
export async function verifyEmail(token: string): Promise<UserDocument> {
  const tokenHash = hashToken(token)
  const user = await User.findOne({ emailVerificationTokenHash: tokenHash })

  if (!user) throw unauthorized('This verification link is invalid or has already been used')

  if (
    !user.emailVerificationExpiresAt ||
    user.emailVerificationExpiresAt.getTime() <= Date.now()
  ) {
    throw unauthorized('This verification link has expired')
  }

  user.emailVerified = true
  user.emailVerificationTokenHash = null
  user.emailVerificationExpiresAt = null
  await user.save()

  logger.info({ userId: String(user._id) }, 'Email verified')
  return user
}

/**
 * Deactivates an account. The data is retained so it can be restored.
 */
export async function deactivateAccount(
  userId: string,
  password: string,
  reason?: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user) throw unauthorized('Account no longer exists')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw unauthorized('Password is incorrect')

  user.accountStatus = 'deactivated'
  user.deactivatedAt = new Date()
  if (reason) {
    user.set('profile.deactivationReason', reason)
  }
  await user.save()

  await revokeAllRefreshTokens(userId)
  logger.info({ userId }, 'Account deactivated')
}

/**
 * Permanently deletes an account. Related records are removed as well.
 */
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user) throw unauthorized('Account no longer exists')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw unauthorized('Password is incorrect')

  await revokeAllRefreshTokens(userId)
  await user.deleteOne()
  logger.info({ userId }, 'Account deleted')
}

