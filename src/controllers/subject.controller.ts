import type { Request, Response } from 'express'
import { Subject } from '../models/subject.model'
import { Topic } from '../models/topic.model'
import { Subtopic, Pattern } from '../models/curriculum.model'
import { PracticeQuestion } from '../models/question.model'
import { TopicProgress } from '../models/topic-progress.model'
import { notFound } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toSubjectDTO } from '../utils/mappers'

/** Turns a name into a URL-safe slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Lists subjects. Shared subjects and the caller's own custom subjects are
 * both visible; other users' custom subjects are never returned.
 */
export async function listSubjects(req: Request, res: Response): Promise<void> {
  const { page, pageSize, search, category, isActive } = req.query as unknown as {
    page: number
    pageSize: number
    search?: string
    category?: string
    isActive?: boolean
  }

  const filter: Record<string, unknown> = {
    $or: [{ ownerId: null }, { ownerId: req.user!.id }],
  }
  if (category) filter.category = category
  if (isActive !== undefined) filter.isActive = isActive
  if (search) filter.name = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

  const [items, total] = await Promise.all([
    Subject.find(filter)
      .sort({ displayOrder: 1, name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Subject.countDocuments(filter),
  ])

  // Attach per-subject aggregates so the UI can show counts without N+1 calls.
  const subjectIds = items.map((s) => s._id)
  const [topicCounts, questionCounts, progressCounts] = await Promise.all([
    Topic.aggregate<{ _id: unknown; count: number }>([
      { $match: { subjectId: { $in: subjectIds } } },
      { $group: { _id: '$subjectId', count: { $sum: 1 } } },
    ]),
    PracticeQuestion.aggregate<{ _id: unknown; count: number }>([
      { $match: { userId: req.user!.id, subjectId: { $in: subjectIds } } },
      { $group: { _id: '$subjectId', count: { $sum: 1 } } },
    ]),
    TopicProgress.aggregate<{ _id: unknown; count: number }>([
      {
        $match: {
          userId: req.user!.id,
          subjectId: { $in: subjectIds },
          status: 'completed',
        },
      },
      { $group: { _id: '$subjectId', count: { $sum: 1 } } },
    ]),
  ])

  const topicMap = new Map(topicCounts.map((r) => [String(r._id), r.count]))
  const questionMap = new Map(questionCounts.map((r) => [String(r._id), r.count]))
  const progressMap = new Map(progressCounts.map((r) => [String(r._id), r.count]))

  const data = items.map((subject) => {
    const topicsCount = topicMap.get(String(subject._id)) ?? 0
    const completed = progressMap.get(String(subject._id)) ?? 0
    return toSubjectDTO(subject, {
      topicsCount,
      questionsCount: questionMap.get(String(subject._id)) ?? 0,
      completionPercent: topicsCount > 0 ? Math.round((completed / topicsCount) * 100) : 0,
    })
  })

  sendPaginated(res, data, total, page, pageSize)
}

/** GET /api/subjects/:id */
export async function getSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findOne({
    _id: req.params.id,
    $or: [{ ownerId: null }, { ownerId: req.user!.id }],
  }).lean()

  if (!subject) throw notFound('Subject not found')
  sendData(res, toSubjectDTO(subject))
}

/** POST /api/subjects */
export async function createSubject(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    name: string
    code?: string
    description?: string
    category: string
    color?: string
    icon?: string
    displayOrder?: number
    isActive?: boolean
  }

  const slug = slugify(body.name)
  const existing = await Subject.findOne({ slug }).lean()
  if (existing) throw notFound('A subject with this name already exists')

  const subject = await Subject.create({
    name: body.name,
    slug,
    code: body.code ?? null,
    description: body.description ?? null,
    category: body.category,
    color: body.color ?? null,
    icon: body.icon ?? null,
    displayOrder: body.displayOrder ?? 0,
    isActive: body.isActive ?? true,
    // Custom subjects belong to the creator; shared subjects have no owner.
    ownerId: req.user!.id,
  })

  sendData(res, toSubjectDTO(subject.toObject()), 201)
}

/** PATCH /api/subjects/:id */
export async function updateSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findOne({ _id: req.params.id, ownerId: req.user!.id })
  if (!subject) throw notFound('Subject not found')

  const body = req.body as Record<string, unknown>
  if (body.name !== undefined) {
    subject.name = body.name as string
    subject.slug = slugify(body.name as string)
  }
  if (body.code !== undefined) subject.code = body.code as string
  if (body.description !== undefined) subject.description = body.description as string
  if (body.category !== undefined) subject.category = body.category as never
  if (body.color !== undefined) subject.color = body.color as string
  if (body.icon !== undefined) subject.icon = body.icon as string
  if (body.displayOrder !== undefined) subject.displayOrder = body.displayOrder as number
  if (body.isActive !== undefined) subject.isActive = body.isActive as boolean

  await subject.save()
  sendData(res, toSubjectDTO(subject.toObject()))
}

/** DELETE /api/subjects/:id */
export async function deleteSubject(req: Request, res: Response): Promise<void> {
  const subject = await Subject.findOne({ _id: req.params.id, ownerId: req.user!.id })
  if (!subject) throw notFound('Subject not found')

  // Remove the custom curriculum that belongs to this subject.
  const topicIds = await Topic.find({ subjectId: subject._id, ownerId: req.user!.id }).distinct('_id')
  await Promise.all([
    Topic.deleteMany({ subjectId: subject._id, ownerId: req.user!.id }),
    Subtopic.deleteMany({ topicId: { $in: topicIds } }),
    Pattern.deleteMany({ topicId: { $in: topicIds } }),
  ])
  await subject.deleteOne()

  sendData(res, { message: 'Subject deleted' })
}
