import type { Request, Response } from 'express'
import { PracticeQuestion, QuestionAttempt } from '../models/question.model'
import { notFound } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toAttemptDTO, toQuestionDTO } from '../utils/mappers'
import { recordActivity } from '../services/activity.service'
import { gradeAnswer } from '../services/grading.service'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Lists the caller's questions with filtering, search and pagination. */
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number
    pageSize: number
    search?: string
    subjectId?: string
    topicId?: string
    subtopicId?: string
    patternId?: string
    difficulty?: string
    type?: string
    status?: string
    favoriteOnly?: boolean
    tags?: string
  }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.subjectId) filter.subjectId = query.subjectId
  if (query.topicId) filter.topicId = query.topicId
  if (query.subtopicId) filter.subtopicId = query.subtopicId
  if (query.patternId) filter.patternId = query.patternId
  if (query.difficulty) filter.difficulty = query.difficulty
  if (query.type) filter.type = query.type
  if (query.status) filter.status = query.status
  if (query.favoriteOnly) filter.isFavorite = true
  if (query.tags) {
    const tags = query.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    if (tags.length) filter.tags = { $all: tags }
  }
  if (query.search) {
    const regex = { $regex: escapeRegex(query.search), $options: 'i' }
    filter.$or = [{ title: regex }, { body: regex }, { tags: regex }]
  }

  const [items, total] = await Promise.all([
    PracticeQuestion.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    PracticeQuestion.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toQuestionDTO), total, query.page, query.pageSize)
}

/** GET /api/questions/:id */
export async function getQuestion(req: Request, res: Response): Promise<void> {
  const question = await PracticeQuestion.findOne({ _id: req.params.id, userId: req.user!.id }).lean()
  if (!question) throw notFound('Question not found')
  sendData(res, toQuestionDTO(question))
}

/** POST /api/questions */
export async function createQuestion(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>

  const question = await PracticeQuestion.create({
    userId: req.user!.id,
    title: body.title,
    body: body.body ?? null,
    subjectId: body.subjectId ?? null,
    topicId: body.topicId ?? null,
    subtopicId: body.subtopicId ?? null,
    patternId: body.patternId ?? null,
    type: body.type ?? 'text',
    difficulty: body.difficulty ?? 'medium',
    options: body.options ?? [],
    correctAnswer: body.correctAnswer ?? null,
    explanation: body.explanation ?? null,
    timeLimitSeconds: body.timeLimitSeconds ?? null,
    tags: body.tags ?? [],
    personalNotes: body.personalNotes ?? null,
    solutionReference: body.solutionReference ?? null,
    source: body.source ?? null,
    externalUrl: body.externalUrl ?? null,
    confidence: body.confidence ?? 0,
  })

  await recordActivity({
    userId: req.user!.id,
    eventType: 'question_created',
    entityType: 'PracticeQuestion',
    entityId: question._id,
    metadata: { title: question.title, difficulty: question.difficulty },
  })

  sendData(res, toQuestionDTO(question.toObject()), 201)
}

/** PATCH /api/questions/:id */
export async function updateQuestion(req: Request, res: Response): Promise<void> {
  const question = await PracticeQuestion.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!question) throw notFound('Question not found')

  const body = req.body as Record<string, unknown>
  const mutable = [
    'title',
    'body',
    'subjectId',
    'topicId',
    'subtopicId',
    'patternId',
    'type',
    'difficulty',
    'options',
    'correctAnswer',
    'explanation',
    'timeLimitSeconds',
    'tags',
    'personalNotes',
    'solutionReference',
    'source',
    'externalUrl',
    'confidence',
  ]

  for (const field of mutable) {
    if (body[field] !== undefined) {
      ;(question as unknown as Record<string, unknown>)[field] = body[field]
    }
  }

  await question.save()
  sendData(res, toQuestionDTO(question.toObject()))
}

/** DELETE /api/questions/:id */
export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const question = await PracticeQuestion.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!question) throw notFound('Question not found')

  await Promise.all([
    QuestionAttempt.deleteMany({ questionId: question._id, userId: req.user!.id }),
    question.deleteOne(),
  ])

  sendData(res, { message: 'Question deleted' })
}

/**
 * POST /api/questions/:id/attempt
 *
 * Records an attempt, grades it against the stored correct answer and updates
 * the question's counters. Accuracy is always derived from these records.
 */
export async function attemptQuestion(req: Request, res: Response): Promise<void> {
  const question = await PracticeQuestion.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!question) throw notFound('Question not found')

  const body = req.body as { answer: unknown; timeTakenSeconds?: number }
  const isCorrect = gradeAnswer(question.type, question.correctAnswer, body.answer)

  const attempt = await QuestionAttempt.create({
    userId: req.user!.id,
    questionId: question._id,
    answer: body.answer ?? null,
    isCorrect,
    timeTakenSeconds: body.timeTakenSeconds ?? null,
  })

  question.attemptsCount = (question.attemptsCount ?? 0) + 1
  if (isCorrect) {
    question.correctCount = (question.correctCount ?? 0) + 1
    question.solvedCount = (question.solvedCount ?? 0) + 1
    question.status = 'solved'
  } else {
    question.status = 'attempted'
  }
  question.lastAttemptedAt = new Date()
  await question.save()

  await recordActivity({
    userId: req.user!.id,
    eventType: 'question_attempted',
    entityType: 'PracticeQuestion',
    entityId: question._id,
    metadata: {
      isCorrect,
      difficulty: question.difficulty,
      subjectId: question.subjectId ? String(question.subjectId) : null,
      topicId: question.topicId ? String(question.topicId) : null,
      timeTakenSeconds: body.timeTakenSeconds ?? null,
    },
  })

  sendData(res, toAttemptDTO(attempt.toObject()), 201)
}

/** GET /api/questions/:id/attempts */
export async function listAttempts(req: Request, res: Response): Promise<void> {
  const question = await PracticeQuestion.findOne({
    _id: req.params.id,
    userId: req.user!.id,
  }).lean()
  if (!question) throw notFound('Question not found')

  const attempts = await QuestionAttempt.find({
    questionId: question._id,
    userId: req.user!.id,
  })
    .sort({ createdAt: -1 })
    .lean()

  sendData(res, attempts.map(toAttemptDTO))
}

/** POST /api/questions/:id/favorite */
export async function toggleFavorite(req: Request, res: Response): Promise<void> {
  const question = await PracticeQuestion.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!question) throw notFound('Question not found')

  const { favorite } = req.body as { favorite: boolean }
  question.isFavorite = favorite
  await question.save()

  sendData(res, toQuestionDTO(question.toObject()))
}
