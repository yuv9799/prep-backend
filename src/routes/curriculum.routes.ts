import { Router } from 'express'
import * as subjectController from '../controllers/subject.controller'
import * as topicController from '../controllers/topic.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { authGate } from '../middleware/auth.middleware'
import {
  createSubjectSchema,
  createTopicSchema,
  idParamsSchema,
  listSubjectsQuerySchema,
  listTopicsQuerySchema,
  subjectIdParamsSchema,
  topicIdParamsSchema,
  updateSubjectSchema,
  updateTopicProgressSchema,
  updateTopicSchema,
} from '../validators/curriculum.validator'

const router = Router()

authGate(router)

// ── Subjects ──────────────────────────────────────────────────────────────
router.get(
  '/subjects',
  validate({ query: listSubjectsQuerySchema }),
  asyncHandler(subjectController.listSubjects),
)
router.post(
  '/subjects',
  validate({ body: createSubjectSchema }),
  asyncHandler(subjectController.createSubject),
)
router.get(
  '/subjects/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(subjectController.getSubject),
)
router.patch(
  '/subjects/:id',
  validate({ params: idParamsSchema, body: updateSubjectSchema }),
  asyncHandler(subjectController.updateSubject),
)
router.delete(
  '/subjects/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(subjectController.deleteSubject),
)

// Topics nested under a subject.
router.get(
  '/subjects/:subjectId/topics',
  validate({ params: subjectIdParamsSchema, query: listTopicsQuerySchema }),
  asyncHandler(topicController.listTopicsBySubject),
)

// ── Topics ────────────────────────────────────────────────────────────────
router.get(
  '/topics',
  validate({ query: listTopicsQuerySchema }),
  asyncHandler(topicController.listTopics),
)
router.post(
  '/topics',
  validate({ body: createTopicSchema }),
  asyncHandler(topicController.createTopic),
)
router.get(
  '/topics/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(topicController.getTopic),
)
router.patch(
  '/topics/:id',
  validate({ params: idParamsSchema, body: updateTopicSchema }),
  asyncHandler(topicController.updateTopic),
)
router.delete(
  '/topics/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(topicController.deleteTopic),
)
router.get(
  '/topics/:topicId/subtopics',
  validate({ params: topicIdParamsSchema }),
  asyncHandler(topicController.listSubtopics),
)
router.get(
  '/topics/:topicId/patterns',
  validate({ params: topicIdParamsSchema }),
  asyncHandler(topicController.listPatterns),
)

router.patch(
  '/topics/:topicId/progress',
  validate({ params: topicIdParamsSchema, body: updateTopicProgressSchema }),
  asyncHandler(topicController.updateTopicProgress),
)

export default router
