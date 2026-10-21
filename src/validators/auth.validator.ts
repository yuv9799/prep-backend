import { z } from 'zod'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../services/password.service'

/** Normalises emails to lowercase and trims whitespace before validation. */
export const emailSchema = z
  .string()
  .trim()
  .min(3, 'Email is required')
  .max(254, 'Email is too long')
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase())

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters`)

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email: emailSchema,
  password: passwordSchema,
  targetRole: z.string().trim().max(120).optional(),
  targetCompanies: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  graduationYear: z
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 10)
    .optional(),
})

export const loginSchema = z.object({
  email: emailSchema,
  // No length rules here: a wrong password should fail with 401, not 422.
  password: z.string().min(1, 'Password is required').max(PASSWORD_MAX_LENGTH),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'A reset token is required').max(512),
  password: passwordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
})

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'A verification token is required').max(512),
})

export const resendVerificationSchema = z.object({
  email: emailSchema,
})

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    targetRole: z.string().trim().max(120).nullable().optional(),
    targetCompanies: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
    graduationYear: z.number().int().min(1950).max(new Date().getFullYear() + 10).nullable().optional(),
  })
  .strict()

export const updatePreferencesSchema = z
  .object({
    dailyGoalMinutes: z.number().int().min(0).max(1440).optional(),
    dailyGoalQuestions: z.number().int().min(0).max(1000).optional(),
    preferredSessionType: z.enum(['study', 'practice', 'revision', 'mock']).optional(),
    timezone: z.string().trim().max(64).optional(),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .strict()

export const deactivateAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  reason: z.string().trim().max(500).optional(),
})

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Type DELETE to confirm account deletion' }),
  }),
})

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier'),
})
