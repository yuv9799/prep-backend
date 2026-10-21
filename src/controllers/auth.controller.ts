import type { Request, Response } from 'express'
import { User } from '../models/user.model'
import { RefreshToken } from '../models/refresh-token.model'
import {
  attachAuthCookies,
  authenticateUser,
  changePassword,
  deactivateAccount,
  deleteAccount,
  issueEmailVerification,
  issueTokens,
  registerUser,
  requestPasswordReset,
  resetPassword,
  revokeAllRefreshTokens,
  rotateRefreshToken,
  toPublicUser,
  verifyEmail,
} from '../services/auth.service'
import { deleteUserOwnedData } from '../services/user-data.service'
import { clearAuthCookies, cookieNames } from '../utils/cookies'
import { sendData } from '../utils/response'
import { unauthorized } from '../utils/errors'
import { hashToken } from '../services/token.service'

/** POST /api/auth/register */
export async function register(req: Request, res: Response): Promise<void> {
  const payload = req.body as {
    name: string
    email: string
    password: string
    targetRole?: string
    targetCompanies?: string[]
    graduationYear?: number
  }

  const user = await registerUser(payload)
  const tokens = await issueTokens(user, req)
  attachAuthCookies(res, tokens)

  // Verification is sent after the response so a slow SMTP server cannot
  // delay the signup.
  void issueEmailVerification(user).catch(() => undefined)

  sendData(
    res,
    {
      user: toPublicUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
    },
    201,
  )
}

/** POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string }
  const user = await authenticateUser(email, password)
  const tokens = await issueTokens(user, req)
  attachAuthCookies(res, tokens)

  sendData(res, {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
  })
}

/** POST /api/auth/logout */
export async function logout(req: Request, res: Response): Promise<void> {
  const refreshToken =
    (req.cookies as Record<string, string> | undefined)?.[cookieNames.refresh] ??
    (req.body as { refreshToken?: string } | undefined)?.refreshToken
  if (refreshToken) {
    // Revoke the presented refresh token so it cannot be reused.
    await RefreshToken.updateMany(
      { tokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    )
  }
  clearAuthCookies(res)
  sendData(res, { message: 'Signed out' })
}

/** POST /api/auth/refresh */
export async function refresh(req: Request, res: Response): Promise<void> {
  const token =
    (req.cookies as Record<string, string> | undefined)?.[cookieNames.refresh] ??
    (req.body as { refreshToken?: string } | undefined)?.refreshToken

  if (!token) throw unauthorized('No refresh token provided')

  const { user, tokens } = await rotateRefreshToken(token, req)
  attachAuthCookies(res, tokens)

  sendData(res, {
    user: toPublicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokens: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
  })
}

/** GET /api/auth/me */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id)
  if (!user) throw unauthorized('Account no longer exists')
  sendData(res, toPublicUser(user))
}
