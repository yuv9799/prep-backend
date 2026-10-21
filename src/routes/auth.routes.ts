import { Router } from 'express'
import * as controller from '../controllers/auth.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { requireAuth } from '../middleware/auth.middleware'
import { authLimiter, sensitiveLimiter } from '../middleware/rate-limit.middleware'
import {
  changePasswordSchema,
  deactivateAccountSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  idParamSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updatePreferencesSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from '../validators/auth.validator'

const router = Router()

// Credential endpoints get the stricter limiter.
router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(controller.register),
)

router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login))

router.post('/logout', asyncHandler(controller.logout))

router.post(
  '/refresh',
  authLimiter,
  asyncHandler(controller.refresh),
)

router.get('/me', requireAuth, asyncHandler(controller.me))

router.patch(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateProfile),
)

router.patch(
  '/preferences',
  requireAuth,
  validate({ body: updatePreferencesSchema }),
  asyncHandler(controller.updatePreferences),
)

router.post(
  '/forgot-password',
  sensitiveLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(controller.forgotPassword),
)

router.post(
  '/reset-password',
  sensitiveLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(controller.resetPasswordHandler),
)

router.post(
  '/change-password',
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(controller.changePasswordHandler),
)

router.post(
  '/verify-email',
  sensitiveLimiter,
  validate({ body: verifyEmailSchema }),
  asyncHandler(controller.verifyEmailHandler),
)

router.post(
  '/resend-verification',
  sensitiveLimiter,
  validate({ body: resendVerificationSchema }),
  asyncHandler(controller.resendVerification),
)

router.post(
  '/deactivate',
  requireAuth,
  validate({ body: deactivateAccountSchema }),
  asyncHandler(controller.deactivate),
)

router.delete(
  '/me',
  requireAuth,
  validate({ body: deleteAccountSchema }),
  asyncHandler(controller.remove),
)

router.post('/logout-all', requireAuth, asyncHandler(controller.logoutAll))

export default router
export { idParamSchema }
