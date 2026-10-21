import { Router } from 'express'
import * as controller from '../controllers/analytics.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { authGate } from '../middleware/auth.middleware'

const router = Router()

authGate(router)

router.get(
  '/analytics/overview',
  validate({ query: controller.activityQuerySchema }),
  asyncHandler(controller.overview),
)
router.get('/analytics/dashboard', asyncHandler(controller.dashboard))
router.get(
  '/analytics/activity',
  validate({ query: controller.activityQuerySchema }),
  asyncHandler(controller.activity),
)
router.get('/analytics/subjects', asyncHandler(controller.subjectProgress))

export default router
