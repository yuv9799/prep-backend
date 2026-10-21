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
  const refreshToken = (req.cookies as Record<string, string> | undefined)?.[cookieNames.refresh]
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

/** PATCH /api/auth/me */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    name?: string
    targetRole?: string | null
    targetCompanies?: string[]
    graduationYear?: number | null
  }

  const user = await User.findById(req.user!.id)
  if (!user) throw unauthorized('Account no longer exists')

  if (body.name !== undefined) user.name = body.name
  if (body.targetRole !== undefined) user.profile.targetRole = body.targetRole
  if (body.targetCompanies !== undefined) user.profile.targetCompanies = body.targetCompanies
  if (body.graduationYear !== undefined) user.profile.graduationYear = body.graduationYear

  await user.save()
  sendData(res, toPublicUser(user))
}


/** PATCH /api/auth/preferences */
export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id)
  if (!user) throw unauthorized('Account no longer exists')

  const body = req.body as Record<string, unknown>
  if (body.dailyGoalMinutes !== undefined)
    user.studyPreferences.dailyGoalMinutes = body.dailyGoalMinutes as number
  if (body.dailyGoalQuestions !== undefined)
    user.studyPreferences.dailyGoalQuestions = body.dailyGoalQuestions as number
  if (body.preferredSessionType !== undefined)
    user.studyPreferences.preferredSessionType = body.preferredSessionType as never
  if (body.timezone !== undefined) user.studyPreferences.timezone = body.timezone as string
  if (body.weekStartsOn !== undefined)
    user.studyPreferences.weekStartsOn = body.weekStartsOn as 0 | 1

  await user.save()
  sendData(res, {
    dailyGoalMinutes: user.studyPreferences.dailyGoalMinutes,
    dailyGoalQuestions: user.studyPreferences.dailyGoalQuestions,
    preferredSessionType: user.studyPreferences.preferredSessionType,
    timezone: user.studyPreferences.timezone,
    weekStartsOn: user.studyPreferences.weekStartsOn,
  })
}

/** POST /api/auth/forgot-password */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string }
  // Always the same response, so registered emails cannot be discovered.
  await requestPasswordReset(email)
  sendData(
    res,
    { message: 'If an account exists for that email, a reset link has been sent.' },
    202,
  )
}

/** POST /api/auth/reset-password */
export async function resetPasswordHandler(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string }
  const user = await resetPassword(token, password)
  const tokens = await issueTokens(user, req)
  attachAuthCookies(res, tokens)
  sendData(res, { message: 'Password reset successfully', user: toPublicUser(user) })
}

/** POST /api/auth/change-password */
export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string
    newPassword: string
  }
  await changePassword(req.user!.id, currentPassword, newPassword)
  clearAuthCookies(res)
  sendData(res, { message: 'Password changed. Please sign in again.' })
}

/** POST /api/auth/verify-email */
export async function verifyEmailHandler(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token: string }
  const user = await verifyEmail(token)
  sendData(res, { message: 'Email verified', user: toPublicUser(user) })
}

/** POST /api/auth/resend-verification */
export async function resendVerification(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string }
  const user = await User.findOne({ email, emailVerified: false })
  if (user) {
    await issueEmailVerification(user)
  }
  sendData(res, { message: 'If the account needs verification, an email has been sent.' }, 202)
}

/** POST /api/auth/deactivate */
export async function deactivate(req: Request, res: Response): Promise<void> {
  const { password, reason } = req.body as { password: string; reason?: string }
  await deactivateAccount(req.user!.id, password, reason)
  clearAuthCookies(res)
  sendData(res, { message: 'Account deactivated' })
}

/** DELETE /api/auth/me */
export async function remove(req: Request, res: Response): Promise<void> {
  const { password } = req.body as { password: string }
  await deleteUserOwnedData(req.user!.id)
  await deleteAccount(req.user!.id, password)
  clearAuthCookies(res)
  sendData(res, { message: 'Account deleted' })
}

/** POST /api/auth/logout-all */
export async function logoutAll(req: Request, res: Response): Promise<void> {
  await revokeAllRefreshTokens(req.user!.id)
  clearAuthCookies(res)
  sendData(res, { message: 'Signed out of all devices' })
}
