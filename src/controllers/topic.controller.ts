import type { Request, Response } from 'express'
import { Topic } from '../models/topic.model'
import { Subtopic, Pattern } from '../models/curriculum.model'
import { Subject } from '../models/subject.model'
import { PracticeQuestion } from '../models/question.model'
import { TopicProgress } from '../models/topic-progress.model'
import { notFound, badRequest } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toPatternDTO, toSubtopicDTO, toTopicDTO } from '../utils/mappers'
import { toProgressDTO } from '../utils/mappers.task'
import { slugify } from './subject.controller'

/** Escapes user input for safe use inside a MongoDB `$regex`. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Lists topics. Shared curriculum topics and the caller's own custom topics
 * are both returned.
 */
export async function listTopics(req: Request, res: Response): Promise<void> {
  const { page, pageSize, search, subjectId, parentTopicId, difficulty } = req.query as unknown as {
    page: number
    pageSize: number
    search?: string
    subjectId?: string
    parentTopicId?: string
    difficulty?: string
  }

  const filter: Record<string, unknown> = {
    $or: [{ ownerId: null }, { ownerId: req.user!.id }],
  }
  if (subjectId) filter.subjectId = subjectId
  if (parentTopicId) filter.parentTopicId = parentTopicId
  if (difficulty) filter.difficulty = difficulty
  if (search) {
    filter.$and = [
      {
        $or: [
          { name: { $regex: escapeRegex(search), $options: 'i' } },
          { description: { $regex: escapeRegex(search), $options: 'i' } },
        ],
      },
    ]
  }

  const [items, total] = await Promise.all([
    Topic.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Topic.countDocuments(filter),
  ])

  const topicIds = items.map((t) => t._id)
  const [questionCounts, patternCounts, progressRows] = await Promise.all([
    PracticeQuestion.aggregate<{ _id: unknown; count: number }>([
      { $match: { userId: req.user!.id, topicId: { $in: topicIds } } },
      { $group: { _id: '$topicId', count: { $sum: 1 } } },
    ]),
    Pattern.aggregate<{ _id: unknown; count: number }>([
      { $match: { topicId: { $in: topicIds } } },
      { $group: { _id: '$topicId', count: { $sum: 1 } } },
    ]),
    TopicProgress.find({ userId: req.user!.id, topicId: { $in: topicIds } }).lean(),
  ])

  const questionMap = new Map(questionCounts.map((r) => [String(r._id), r.count]))
  const patternMap = new Map(patternCounts.map((r) => [String(r._id), r.count]))
  const progressMap = new Map(progressRows.map((p) => [String(p.topicId), p]))

  const data = items.map((topic) => {
    const progress = progressMap.get(String(topic._id))
    return toTopicDTO(topic, {
      questionsCount: questionMap.get(String(topic._id)) ?? 0,
      patternsCount: patternMap.get(String(topic._id)) ?? 0,
      completionPercent: progress?.status === 'completed' ? 100 : progress ? 50 : 0,
    })
  })

  sendPaginated(res, data, total, page, pageSize)
}

/** GET /api/topics/:id */
export async function getTopic(req: Request, res: Response): Promise<void> {
  const topic = await Topic.findOne({
    _id: req.params.id,
    $or: [{ ownerId: null }, { ownerId: req.user!.id }],
  }).lean()

  if (!topic) throw notFound('Topic not found')
  sendData(res, toTopicDTO(topic))
}

/** POST /api/topics */
export async function createTopic(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    name: string
    description?: string
    subjectId: string
    parentTopicId?: string | null
    difficulty: string
    prerequisites: string[]
    displayOrder?: number
    estimatedHours?: number | null
    learningObjectives: string[]
  }

  const subject = await Subject.findOne({
    _id: body.subjectId,
    $or: [{ ownerId: null }, { ownerId: req.user!.id }],
  }).lean()
  if (!subject) throw notFound('Subject not found')

  if (body.parentTopicId) {
    const parent = await Topic.findById(body.parentTopicId).lean()
    if (!parent) throw badRequest('Parent topic not found')
  }

  const topic = await Topic.create({
    name: body.name,
    slug: slugify(body.name),
    description: body.description ?? null,
    subjectId: body.subjectId,
    parentTopicId: body.parentTopicId ?? null,
    difficulty: body.difficulty,
    prerequisites: body.prerequisites ?? [],
    displayOrder: body.displayOrder ?? 0,
    estimatedHours: body.estimatedHours ?? null,
    learningObjectives: body.learningObjectives ?? [],
    ownerId: req.user!.id,
  })

  sendData(res, toTopicDTO(topic.toObject()), 201)
}

/** PATCH /api/topics/:id */
export async function updateTopic(req: Request, res: Response): Promise<void> {
  const topic = await Topic.findOne({ _id: req.params.id, ownerId: req.user!.id })
  if (!topic) throw notFound('Topic not found')

  const body = req.body as Record<string, unknown>
  if (body.name !== undefined) {
    topic.name = body.name as string
    topic.slug = slugify(body.name as string)
  }
  if (body.description !== undefined) topic.description = body.description as string
  if (body.subjectId !== undefined) topic.set('subjectId', body.subjectId)
  if (body.parentTopicId !== undefined) topic.set('parentTopicId', body.parentTopicId)
  if (body.difficulty !== undefined) topic.difficulty = body.difficulty as never
  if (body.prerequisites !== undefined) topic.set('prerequisites', body.prerequisites)
  if (body.displayOrder !== undefined) topic.displayOrder = body.displayOrder as number
  if (body.estimatedHours !== undefined) topic.estimatedHours = body.estimatedHours as number | null
  if (body.learningObjectives !== undefined)
    topic.set('learningObjectives', body.learningObjectives)

  await topic.save()
  sendData(res, toTopicDTO(topic.toObject()))
}

/** DELETE /api/topics/:id */
export async function deleteTopic(req: Request, res: Response): Promise<void> {
  const topic = await Topic.findOne({ _id: req.params.id, ownerId: req.user!.id })
  if (!topic) throw notFound('Topic not found')

  // Also remove descendants, their subtopics, patterns and progress records.
  const descendants = await Topic.find({ parentTopicId: topic._id }).distinct('_id')
  const allTopicIds = [topic._id, ...descendants]

  await Promise.all([
    Topic.deleteMany({ parentTopicId: { $in: allTopicIds }, ownerId: req.user!.id }),
    Subtopic.deleteMany({ topicId: { $in: allTopicIds } }),
    Pattern.deleteMany({ topicId: { $in: allTopicIds } }),
    TopicProgress.deleteMany({ topicId: { $in: allTopicIds }, userId: req.user!.id }),
  ])
  await topic.deleteOne()

  sendData(res, { message: 'Topic deleted' })
}

/** GET /api/subjects/:subjectId/topics */
export async function listTopicsBySubject(req: Request, res: Response): Promise<void> {
  req.query = { ...(req.query as object), subjectId: req.params.subjectId }
  await listTopics(req, res)
}

/** GET /api/topics/:topicId/subtopics */
export async function listSubtopics(req: Request, res: Response): Promise<void> {
  const items = await Subtopic.find({ topicId: req.params.topicId })
    .sort({ displayOrder: 1, name: 1 })
    .lean()
  sendData(res, items.map(toSubtopicDTO))
}

/** GET /api/topics/:topicId/patterns */
export async function listPatterns(req: Request, res: Response): Promise<void> {
  const items = await Pattern.find({ topicId: req.params.topicId })
    .sort({ name: 1 })
    .lean()
  sendData(res, items.map(toPatternDTO))
}

/** PATCH /api/topics/:topicId/progress */
export async function updateTopicProgress(req: Request, res: Response): Promise<void> {
  const topic = await Topic.findOne({
    _id: req.params.topicId,
    $or: [{ ownerId: null }, { ownerId: req.user!.id }],
  }).lean()
  if (!topic) throw notFound('Topic not found')

  let progress = await TopicProgress.findOne({
    userId: req.user!.id,
    topicId: req.params.topicId,
  })

  if (!progress) {
    progress = await TopicProgress.create({
      userId: req.user!.id,
      topicId: req.params.topicId,
      subjectId: topic.subjectId as never,
      status: 'not_started',
    })
  }

  const body = req.body as {
    status?: string
    confidence?: number
    estimatedStudyMinutes?: number
    actualStudyMinutes?: number
    startedAt?: string | null
    completedAt?: string | null
    lastReviewedAt?: string | null
    nextReviewAt?: string | null
    revisionCount?: number
    notes?: string | null
  }

  if (body.status !== undefined) progress.set('status', body.status)
  if (body.confidence !== undefined) progress.confidence = body.confidence
  if (body.estimatedStudyMinutes !== undefined)
    progress.estimatedStudyMinutes = body.estimatedStudyMinutes
  if (body.actualStudyMinutes !== undefined) progress.actualStudyMinutes = body.actualStudyMinutes
  if (body.startedAt !== undefined)
    progress.startedAt = body.startedAt ? new Date(body.startedAt) : null
  if (body.completedAt !== undefined)
    progress.completedAt = body.completedAt ? new Date(body.completedAt) : null
  if (body.lastReviewedAt !== undefined)
    progress.lastReviewedAt = body.lastReviewedAt ? new Date(body.lastReviewedAt) : null
  if (body.nextReviewAt !== undefined)
    progress.nextReviewAt = body.nextReviewAt ? new Date(body.nextReviewAt) : null
  if (body.revisionCount !== undefined) progress.revisionCount = body.revisionCount
  if (body.notes !== undefined) progress.notes = body.notes ?? null

  await progress.save()
  sendData(res, toProgressDTO(progress.toObject()))
}
