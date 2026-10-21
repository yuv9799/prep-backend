import { Router } from 'express'
import * as taskController from '../controllers/task.controller'
import * as plannerController from '../controllers/planner.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { authGate } from '../middleware/auth.middleware'
import { idParamsSchema } from '../validators/curriculum.validator'
import {
  createRevisionSchema,
  createSessionSchema,
  createTaskLogSchema,
  createTaskSchema,
  listRevisionsQuerySchema,
  listSessionsQuerySchema,
  listTaskLogsQuerySchema,
  listTasksQuerySchema,
  reviewRevisionSchema,
  updateRevisionSchema,
  updateSessionSchema,
  updateTaskSchema,
} from '../validators/planner.validator'

const router = Router()

authGate(router)

// ── Tasks ─────────────────────────────────────────────────────────────────
router.get('/tasks', validate({ query: listTasksQuerySchema }), asyncHandler(taskController.listTasks))
router.post('/tasks', validate({ body: createTaskSchema }), asyncHandler(taskController.createTask))
router.get('/tasks/:id', validate({ params: idParamsSchema }), asyncHandler(taskController.getTask))
router.patch(
  '/tasks/:id',
  validate({ params: idParamsSchema, body: updateTaskSchema }),
  asyncHandler(taskController.updateTask),
)
router.delete('/tasks/:id', validate({ params: idParamsSchema }), asyncHandler(taskController.deleteTask))

// ── Task logs ─────────────────────────────────────────────────────────────
router.get(
  '/task-logs',
  validate({ query: listTaskLogsQuerySchema }),
  asyncHandler(taskController.listTaskLogs),
)
router.post(
  '/task-logs',
  validate({ body: createTaskLogSchema }),
  asyncHandler(taskController.createTaskLog),
)
router.delete(
  '/task-logs/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(taskController.deleteTaskLog),
)

// ── Study sessions ────────────────────────────────────────────────────────
router.get(
  '/sessions',
  validate({ query: listSessionsQuerySchema }),
  asyncHandler(plannerController.listSessions),
)
router.post(
  '/sessions',
  validate({ body: createSessionSchema }),
  asyncHandler(plannerController.createSession),
)
router.get(
  '/sessions/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(plannerController.getSession),
)
router.patch(
  '/sessions/:id',
  validate({ params: idParamsSchema, body: updateSessionSchema }),
  asyncHandler(plannerController.updateSession),
)
router.delete(
  '/sessions/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(plannerController.deleteSession),
)

// ── Revisions ─────────────────────────────────────────────────────────────
// The `/due` route must be declared before `/:id` style routes to avoid it
// being captured as an id.
router.get('/revisions', validate({ query: listRevisionsQuerySchema }), asyncHandler(plannerController.listRevisions))
router.get('/revisions/due', asyncHandler(plannerController.listDueRevisions))
router.post('/revisions', validate({ body: createRevisionSchema }), asyncHandler(plannerController.createRevision))
router.patch(
  '/revisions/:id',
  validate({ params: idParamsSchema, body: updateRevisionSchema }),
  asyncHandler(plannerController.updateRevision),
)
router.post(
  '/revisions/:id/review',
  validate({ params: idParamsSchema, body: reviewRevisionSchema }),
  asyncHandler(plannerController.reviewRevision),
)
router.delete(
  '/revisions/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(plannerController.deleteRevision),
)

export default router
