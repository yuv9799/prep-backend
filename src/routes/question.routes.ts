import { Router } from 'express'
import * as controller from '../controllers/question.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { authGate } from '../middleware/auth.middleware'
import {
  attemptQuestionSchema,
  createQuestionSchema,
  favoriteQuestionSchema,
  idParamsSchema,
  listQuestionsQuerySchema,
  updateQuestionSchema,
} from '../validators/question.validator'

const router = Router()

authGate(router)

router.get('/questions', validate({ query: listQuestionsQuerySchema }), asyncHandler(controller.listQuestions))
router.post('/questions', validate({ body: createQuestionSchema }), asyncHandler(controller.createQuestion))
router.get('/questions/:id', validate({ params: idParamsSchema }), asyncHandler(controller.getQuestion))
router.patch(
  '/questions/:id',
  validate({ params: idParamsSchema, body: updateQuestionSchema }),
  asyncHandler(controller.updateQuestion),
)
router.delete('/questions/:id', validate({ params: idParamsSchema }), asyncHandler(controller.deleteQuestion))
router.post(
  '/questions/:id/attempt',
  validate({ params: idParamsSchema, body: attemptQuestionSchema }),
  asyncHandler(controller.attemptQuestion),
)
router.get(
  '/questions/:id/attempts',
  validate({ params: idParamsSchema }),
  asyncHandler(controller.listAttempts),
)
router.post(
  '/questions/:id/favorite',
  validate({ params: idParamsSchema, body: favoriteQuestionSchema }),
  asyncHandler(controller.toggleFavorite),
)

export default router
