import type { Request, Response } from 'express'
import { StudySession } from '../models/study-session.model'
import { TaskLog } from '../models/task.model'
import { Revision } from '../models/revision.model'
import { notFound } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toRevisionDTO, toSessionDTO } from '../utils/mappers.task'
import { recordActivity } from '../services/activity.service'
import { scheduleNextReview } from '../services/spaced-repetition.service'

/** GET /api/sessions */
export async function listSessions(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number
    pageSize: number
    subjectId?: string
    topicId?: string
    taskId?: string
    sessionType?: string
    from?: string
    to?: string
  }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.subjectId) filter.subjectId = query.subjectId
  if (query.topicId) filter.topicId = query.topicId
  if (query.taskId) filter.taskId = query.taskId
  if (query.sessionType) filter.sessionType = query.sessionType
  if (query.from || query.to) {
    const startedAt: Record<string, Date> = {}
    if (query.from) startedAt.$gte = new Date(query.from)
    if (query.to) startedAt.$lte = new Date(query.to)
    filter.startedAt = startedAt
  }

  const [items, total] = await Promise.all([
    StudySession.find(filter)
      .sort({ startedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    StudySession.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toSessionDTO), total, query.page, query.pageSize)
}

/**
 * POST /api/sessions
 *
 * Creating a session is idempotent on `(userId, idempotencyKey)`: a retried
 * request returns the original session instead of creating a duplicate.
 */
export async function createSession(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    subjectId?: string | null
    topicId?: string | null
    taskId?: string | null
    startedAt: string
    endedAt?: string
    durationSeconds?: number
    sessionType: string
    notes?: string
    idempotencyKey: string
  }

  const existing = await StudySession.findOne({
    userId: req.user!.id,
    idempotencyKey: body.idempotencyKey,
  }).lean()

  if (existing) {
    // The client already sent this request; return the original result.
    sendData(res, toSessionDTO(existing), 200)
    return
  }

  const startedAt = new Date(body.startedAt)
  const endedAt = body.endedAt ? new Date(body.endedAt) : null
  const durationSeconds =
    body.durationSeconds ??
    (endedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : 0)

  const session = await StudySession.create({
    userId: req.user!.id,
    subjectId: body.subjectId ?? null,
    topicId: body.topicId ?? null,
    taskId: body.taskId ?? null,
    startedAt,
    endedAt,
    durationSeconds,
    sessionType: body.sessionType,
    notes: body.notes ?? null,
    idempotencyKey: body.idempotencyKey,
  })

  // A completed session is mirrored into the task log so the time totals in
  // the analytics endpoints are consistent.
  if (durationSeconds > 0) {
    await TaskLog.create({
      userId: req.user!.id,
      taskId: body.taskId ?? null,
      subjectId: body.subjectId ?? null,
      topicId: body.topicId ?? null,
      minutesSpent: Math.round(durationSeconds / 60),
      questionsAttempted: 0,
      notes: null,
      loggedAt: startedAt,
    })
  }

  await recordActivity({
    userId: req.user!.id,
    eventType: 'session_completed',
    entityType: 'StudySession',
    entityId: session._id,
    metadata: {
      durationSeconds,
      sessionType: body.sessionType,
      subjectId: body.subjectId ?? null,
      topicId: body.topicId ?? null,
    },
  })

  sendData(res, toSessionDTO(session.toObject()), 201)
}

/** GET /api/sessions/:id */
export async function getSession(req: Request, res: Response): Promise<void> {
  const session = await StudySession.findOne({ _id: req.params.id, userId: req.user!.id }).lean()
  if (!session) throw notFound('Session not found')
  sendData(res, toSessionDTO(session))
}

/** DELETE /api/sessions/:id */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const session = await StudySession.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!session) throw notFound('Session not found')
  await session.deleteOne()
  sendData(res, { message: 'Session deleted' })
}

/** PATCH /api/sessions/:id */
export async function updateSession(req: Request, res: Response): Promise<void> {
  const session = await StudySession.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!session) throw notFound('Session not found')

  const body = req.body as {
    subjectId?: string | null
    topicId?: string | null
    taskId?: string | null
    startedAt?: string
    endedAt?: string | null
    durationSeconds?: number
    sessionType?: string
    notes?: string | null
  }

  if (body.subjectId !== undefined) session.set('subjectId', body.subjectId ?? null)
  if (body.topicId !== undefined) session.set('topicId', body.topicId ?? null)
  if (body.taskId !== undefined) session.set('taskId', body.taskId ?? null)
  if (body.startedAt !== undefined) session.startedAt = new Date(body.startedAt)
  if (body.endedAt !== undefined) session.endedAt = body.endedAt ? new Date(body.endedAt) : null
  if (body.durationSeconds !== undefined) session.durationSeconds = body.durationSeconds
  if (body.sessionType !== undefined) session.set('sessionType', body.sessionType)
  if (body.notes !== undefined) session.notes = body.notes ?? null

  await session.save()
  sendData(res, toSessionDTO(session.toObject()))
}

/** GET /api/revisions */
export async function listRevisions(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number
    pageSize: number
    status?: string
    topicId?: string
    subjectId?: string
    dueOnly?: boolean
  }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.status) filter.status = query.status
  if (query.topicId) filter.topicId = query.topicId
  if (query.subjectId) filter.subjectId = query.subjectId
  if (query.dueOnly) {
    filter.scheduledAt = { $lte: new Date() }
    filter.completedAt = null
  }

  const [items, total] = await Promise.all([
    Revision.find(filter)
      .sort({ scheduledAt: 1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    Revision.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toRevisionDTO), total, query.page, query.pageSize)
}

/** GET /api/revisions/due */
export async function listDueRevisions(req: Request, res: Response): Promise<void> {
  const items = await Revision.find({
    userId: req.user!.id,
    completedAt: null,
    scheduledAt: { $lte: new Date() },
  })
    .sort({ scheduledAt: 1 })
    .lean()

  sendData(res, items.map(toRevisionDTO))
}

/** POST /api/revisions */
export async function createRevision(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    topicId?: string | null
    subjectId?: string | null
    questionId?: string | null
    label: string
    scheduledAt: string
    notes?: string
    intervalDays: number
  }

  const revision = await Revision.create({
    userId: req.user!.id,
    topicId: body.topicId ?? null,
    subjectId: body.subjectId ?? null,
    questionId: body.questionId ?? null,
    label: body.label,
    scheduledAt: new Date(body.scheduledAt),
    notes: body.notes ?? null,
    intervalDays: body.intervalDays,
    status: 'scheduled',
  })

  sendData(res, toRevisionDTO(revision.toObject()), 201)
}

/**
 * POST /api/revisions/:id/review
 *
 * Records the outcome of a review and schedules the next one using the
 * spaced-repetition algorithm.
 */
export async function reviewRevision(req: Request, res: Response): Promise<void> {
  const revision = await Revision.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!revision) throw notFound('Revision not found')

  const body = req.body as { quality: number; notes?: string; confidenceAfter?: number }
  const now = new Date()

  const next = scheduleNextReview(
    {
      intervalDays: revision.intervalDays ?? 1,
      easeFactor: revision.easeFactor ?? 2.5,
      repetitions: revision.repetitions ?? 0,
      lapses: revision.lapses ?? 0,
    },
    body.quality,
    now,
  )

  revision.confidenceBefore = revision.confidenceAfter ?? revision.confidenceBefore ?? null
  if (body.confidenceAfter !== undefined) revision.confidenceAfter = body.confidenceAfter
  revision.completedAt = now
  revision.lastReviewedAt = now
  revision.intervalDays = next.intervalDays
  revision.easeFactor = next.easeFactor
  revision.repetitions = next.repetitions
  revision.lapses = next.lapses
  revision.scheduledAt = next.nextReviewAt
  revision.status = 'scheduled'
  if (body.notes !== undefined) revision.notes = body.notes

  await revision.save()

  await recordActivity({
    userId: req.user!.id,
    eventType: 'revision_reviewed',
    entityType: 'Revision',
    entityId: revision._id,
    metadata: {
      quality: body.quality,
      nextReviewAt: next.nextReviewAt.toISOString(),
      intervalDays: next.intervalDays,
      topicId: revision.topicId ? String(revision.topicId) : null,
    },
  })

  sendData(res, toRevisionDTO(revision.toObject()))
}

/** PATCH /api/revisions/:id */
export async function updateRevision(req: Request, res: Response): Promise<void> {
  const revision = await Revision.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!revision) throw notFound('Revision not found')

  const body = req.body as Record<string, unknown>
  if (body.label !== undefined) revision.label = body.label as string
  if (body.scheduledAt !== undefined) revision.scheduledAt = new Date(body.scheduledAt as string)
  if (body.notes !== undefined) revision.notes = body.notes as string
  if (body.status !== undefined) revision.status = body.status as never
  if (body.intervalDays !== undefined) revision.intervalDays = body.intervalDays as number

  await revision.save()
  sendData(res, toRevisionDTO(revision.toObject()))
}

/** DELETE /api/revisions/:id */
export async function deleteRevision(req: Request, res: Response): Promise<void> {
  const revision = await Revision.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!revision) throw notFound('Revision not found')
  await revision.deleteOne()
  sendData(res, { message: 'Revision deleted' })
}

