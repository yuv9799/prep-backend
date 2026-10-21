import { Router } from 'express'
import * as controller from '../controllers/project.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { authGate } from '../middleware/auth.middleware'
import { idParamsSchema } from '../validators/curriculum.validator'
import {
  approveAchievementSchema,
  createAchievementSchema,
  createProjectSchema,
  listAchievementsQuerySchema,
  listProjectsQuerySchema,
  updateAchievementSchema,
  updateProjectSchema,
} from '../validators/project.validator'

const router = Router()

authGate(router)

router.get('/projects', validate({ query: listProjectsQuerySchema }), asyncHandler(controller.listProjects))
router.post('/projects', validate({ body: createProjectSchema }), asyncHandler(controller.createProject))
router.get('/projects/:id', validate({ params: idParamsSchema }), asyncHandler(controller.getProject))
router.patch(
  '/projects/:id',
  validate({ params: idParamsSchema, body: updateProjectSchema }),
  asyncHandler(controller.updateProject),
)
router.delete('/projects/:id', validate({ params: idParamsSchema }), asyncHandler(controller.deleteProject))

router.get(
  '/achievements',
  validate({ query: listAchievementsQuerySchema }),
  asyncHandler(controller.listAchievements),
)
router.post(
  '/achievements',
  validate({ body: createAchievementSchema }),
  asyncHandler(controller.createAchievement),
)
router.patch(
  '/achievements/:id',
  validate({ params: idParamsSchema, body: updateAchievementSchema }),
  asyncHandler(controller.updateAchievement),
)
router.post(
  '/achievements/:id/approve',
  validate({ params: idParamsSchema, body: approveAchievementSchema }),
  asyncHandler(controller.approveAchievement),
)
router.delete(
  '/achievements/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(controller.deleteAchievement),
)

export default router
