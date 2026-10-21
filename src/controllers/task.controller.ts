import type { Request, Response } from 'express'
import { StudyTask, TaskLog } from '../models/task.model'
import { StudySession } from '../models/study-session.model'
import { notFound, badRequest } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toSessionDTO, toTaskDTO, toTaskLogDTO } from '../utils/mappers.task'
import { recordActivity } from '../services/activity.service'
import { scheduleNextReview } from '../services/spaced-repetition.service'
import { Revision } from '../models/revision.model'
import { toRevisionDTO } from '../utils/mappers.task'

/** GET /api/tasks */
export async function listTasks(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number
    pageSize: number
    search?: string
    status?: string
    priority?: string
    subjectId?: string
    topicId?: string
    dueBefore?: string
    dueAfter?: string
  }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.status) filter.status = query.status
  if (query.priority) filter.priority = query.priority
  if (query.subjectId) filter.subjectId = query.subjectId
  if (query.topicId) filter.topicId = query.topicId
  if (query.dueBefore) filter.dueDate = { $lte: new Date(query.dueBefore) }
  if (query.dueAfter) filter.dueDate = { $gte: new Date(query.dueAfter) }
  if (query.search) {
    const regex = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    filter.$or = [{ title: regex }, { description: regex }]
  }

  const [items, total] = await Promise.all([
    StudyTask.find(filter)
      .sort({ status: 1, dueDate: 1, createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    StudyTask.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toTaskDTO), total, query.page, query.pageSize)
}

/** GET /api/tasks/:id */
export async function getTask(req: Request, res: Response): Promise<void> {
  const task = await StudyTask.findOne({ _id: req.params.id, userId: req.user!.id }).lean()
  if (!task) throw notFound('Task not found')
  sendData(res, toTaskDTO(task))
}

/** POST /api/tasks */
export async function createTask(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    title: string
    description?: string
    subjectId?: string | null
    topicId?: string | null
    priority: string
    dueDate?: string | null
    estimatedMinutes?: number | null
  }

  const task = await StudyTask.create({
    userId: req.user!.id,
    title: body.title,
    description: body.description ?? null,
    subjectId: body.subjectId ?? null,
    topicId: body.topicId ?? null,
    priority: body.priority,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    estimatedMinutes: body.estimatedMinutes ?? null,
    status: 'todo',
  })

  await recordActivity({
    userId: req.user!.id,
    eventType: 'task_created',
    entityType: 'StudyTask',
    entityId: task._id,
    metadata: { title: task.title, priority: task.priority },
  })

  sendData(res, toTaskDTO(task.toObject()), 201)
}

/** PATCH /api/tasks/:id */
export async function updateTask(req: Request, res: Response): Promise<void> {
  const task = await StudyTask.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!task) throw notFound('Task not found')

  const body = req.body as Record<string, unknown>
  if (body.title !== undefined) task.title = body.title as string
  if (body.description !== undefined) task.description = body.description as string
  if (body.subjectId !== undefined) task.set('subjectId', body.subjectId)
  if (body.topicId !== undefined) task.set('topicId', body.topicId)
  if (body.priority !== undefined) task.priority = body.priority as never
  if (body.estimatedMinutes !== undefined)
    task.estimatedMinutes = body.estimatedMinutes as number | null
  if (body.dueDate !== undefined)
    task.dueDate = body.dueDate ? new Date(body.dueDate as string) : null

  if (body.status !== undefined) {
    const nextStatus = body.status as string
    task.status = nextStatus as never
    // Stamp (or clear) the completion time consistently with the status.
    task.completedAt = nextStatus === 'done' ? (task.completedAt ?? new Date()) : null
  }

  await task.save()

  await recordActivity({
    userId: req.user!.id,
    eventType: 'task_updated',
    entityType: 'StudyTask',
    entityId: task._id,
    metadata: { title: task.title, status: task.status },
  })

  sendData(res, toTaskDTO(task.toObject()))
}

/** DELETE /api/tasks/:id */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  const task = await StudyTask.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!task) throw notFound('Task not found')
  await task.deleteOne()
  sendData(res, { message: 'Task deleted' })
}

/** GET /api/task-logs */
export async function listTaskLogs(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number
    pageSize: number
    taskId?: string
    subjectId?: string
    topicId?: string
    from?: string
    to?: string
  }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.taskId) filter.taskId = query.taskId
  if (query.subjectId) filter.subjectId = query.subjectId
  if (query.topicId) filter.topicId = query.topicId
  if (query.from || query.to) {
    const loggedAt: Record<string, Date> = {}
    if (query.from) loggedAt.$gte = new Date(query.from)
    if (query.to) loggedAt.$lte = new Date(query.to)
    filter.loggedAt = loggedAt
  }

  const [items, total] = await Promise.all([
    TaskLog.find(filter)
      .sort({ loggedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    TaskLog.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toTaskLogDTO), total, query.page, query.pageSize)
}

/** POST /api/task-logs */
export async function createTaskLog(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    taskId?: string
    subjectId?: string
    topicId?: string
    minutesSpent: number
    questionsAttempted?: number
    notes?: string
    loggedAt?: string
  }

  // A log may reference a task, but only one the caller owns.
  if (body.taskId) {
    const task = await StudyTask.findOne({ _id: body.taskId, userId: req.user!.id }).lean()
    if (!task) throw notFound('Task not found')
  }

  const log = await TaskLog.create({
    userId: req.user!.id,
    taskId: body.taskId ?? null,
    subjectId: body.subjectId ?? null,
    topicId: body.topicId ?? null,
    minutesSpent: body.minutesSpent,
    questionsAttempted: body.questionsAttempted ?? 0,
    notes: body.notes ?? null,
    loggedAt: body.loggedAt ? new Date(body.loggedAt) : new Date(),
  })

  await recordActivity({
    userId: req.user!.id,
    eventType: 'study_logged',
    entityType: 'TaskLog',
    entityId: log._id,
    metadata: {
      minutesSpent: body.minutesSpent,
      questionsAttempted: body.questionsAttempted ?? 0,
      taskId: body.taskId ?? null,
      subjectId: body.subjectId ?? null,
      topicId: body.topicId ?? null,
    },
  })

  sendData(res, toTaskLogDTO(log.toObject()), 201)
}

/** DELETE /api/task-logs/:id */
export async function deleteTaskLog(req: Request, res: Response): Promise<void> {
  const log = await TaskLog.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!log) throw notFound('Log entry not found')
  await log.deleteOne()
  sendData(res, { message: 'Log entry deleted' })
}
