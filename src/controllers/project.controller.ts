import type { Request, Response } from 'express'
import { Project } from '../models/project.model'
import { Achievement } from '../models/achievement.model'
import { notFound } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toAchievementDTO, toProjectDTO } from '../utils/mappers.task'
import { recordActivity } from '../services/activity.service'

/** GET /api/projects */
export async function listProjects(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { page: number; pageSize: number; status?: string }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.status) filter.status = query.status

  const [items, total] = await Promise.all([
    Project.find(filter)
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    Project.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toProjectDTO), total, query.page, query.pageSize)
}

/** GET /api/projects/:id */
export async function getProject(req: Request, res: Response): Promise<void> {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user!.id }).lean()
  if (!project) throw notFound('Project not found')
  sendData(res, toProjectDTO(project))
}

/** POST /api/projects */
export async function createProject(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>

  const project = await Project.create({
    userId: req.user!.id,
    title: body.title,
    description: body.description ?? null,
    technologies: body.technologies ?? [],
    githubUrl: body.githubUrl ?? null,
    repositoryUrl: body.repositoryUrl ?? body.githubUrl ?? null,
    demoUrl: body.demoUrl ?? null,
    status: body.status ?? 'planned',
    startDate: body.startDate ? new Date(body.startDate as string) : null,
    completionDate: body.completionDate ? new Date(body.completionDate as string) : null,
    contributionDetails: body.contributionDetails ?? null,
    evidenceLinks: body.evidenceLinks ?? [],
    highlights: body.highlights ?? [],
  })

  await recordActivity({
    userId: req.user!.id,
    eventType: 'project_created',
    entityType: 'Project',
    entityId: project._id,
    metadata: { title: project.title, status: project.status },
  })

  sendData(res, toProjectDTO(project.toObject()), 201)
}

/** PATCH /api/projects/:id */
export async function updateProject(req: Request, res: Response): Promise<void> {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!project) throw notFound('Project not found')

  const body = req.body as Record<string, unknown>
  if (body.title !== undefined) project.title = body.title as string
  if (body.description !== undefined) project.description = body.description as string
  if (body.technologies !== undefined) project.technologies = body.technologies as never
  if (body.githubUrl !== undefined) project.githubUrl = body.githubUrl as string | null
  if (body.repositoryUrl !== undefined) project.repositoryUrl = body.repositoryUrl as string | null
  if (body.demoUrl !== undefined) project.demoUrl = body.demoUrl as string | null
  if (body.status !== undefined) project.status = body.status as never
  if (body.startDate !== undefined)
    project.startDate = body.startDate ? new Date(body.startDate as string) : null
  if (body.completionDate !== undefined)
    project.completionDate = body.completionDate ? new Date(body.completionDate as string) : null
  if (body.contributionDetails !== undefined)
    project.contributionDetails = body.contributionDetails as string
  if (body.evidenceLinks !== undefined) project.evidenceLinks = body.evidenceLinks as never
  if (body.highlights !== undefined) project.highlights = body.highlights as never

  // Keep the completion timestamp in step with the status.
  if (body.status !== undefined) {
    if (body.status === 'completed') {
      project.completedAt = project.completedAt ?? new Date()
      project.completionDate = project.completionDate ?? project.completedAt
    } else {
      project.completedAt = null
    }
  }

  await project.save()

  sendData(res, toProjectDTO(project.toObject()))
}

/** DELETE /api/projects/:id */
export async function deleteProject(req: Request, res: Response): Promise<void> {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!project) throw notFound('Project not found')
  await project.deleteOne()
  sendData(res, { message: 'Project deleted' })
}

/** GET /api/achievements */
export async function listAchievements(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as {
    page: number
    pageSize: number
    category?: string
    verificationStatus?: string
    sourceType?: string
  }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.category) filter.category = query.category
  if (query.verificationStatus) filter.verificationStatus = query.verificationStatus
  if (query.sourceType) filter.sourceType = query.sourceType

  const [items, total] = await Promise.all([
    Achievement.find(filter)
      .sort({ earnedAt: -1, createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    Achievement.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toAchievementDTO), total, query.page, query.pageSize)
}

/** POST /api/achievements */
export async function createAchievement(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>

  const achievement = await Achievement.create({
    userId: req.user!.id,
    title: body.title,
    description: body.description ?? null,
    category: body.category ?? null,
    icon: body.icon ?? null,
    points: body.points ?? 0,
    evidence: body.evidence ?? null,
    sourceType: body.sourceType ?? 'user_entered',
    sourceId: null,
    // A new achievement starts unverified; it becomes verified only when the
    // owner explicitly approves it.
    verificationStatus: 'pending',
    earnedAt: body.earnedAt ? new Date(body.earnedAt as string) : new Date(),
  })

  sendData(res, toAchievementDTO(achievement.toObject()), 201)
}

/**
 * PATCH /api/achievements/:id
 *
 * Also acts as the approval endpoint: when `verificationStatus` is set to
 * `verified`, `approvedAt` is stamped and the source type is promoted.
 */
export async function updateAchievement(req: Request, res: Response): Promise<void> {
  const achievement = await Achievement.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!achievement) throw notFound('Achievement not found')

  const body = req.body as Record<string, unknown>
  if (body.title !== undefined) achievement.title = body.title as string
  if (body.description !== undefined) achievement.description = body.description as string
  if (body.category !== undefined) achievement.category = body.category as string
  if (body.icon !== undefined) achievement.icon = body.icon as string
  if (body.points !== undefined) achievement.points = body.points as number
  if (body.evidence !== undefined) achievement.evidence = body.evidence as string
  if (body.earnedAt !== undefined) achievement.earnedAt = new Date(body.earnedAt as string)

  if (body.verificationStatus !== undefined) {
    const status = body.verificationStatus as string
    achievement.verificationStatus = status as never
    achievement.approvedAt = status === 'verified' ? new Date() : null
    if (status === 'verified' && achievement.sourceType === 'auto_suggested') {
      achievement.sourceType = 'verified'
    }
  }

  await achievement.save()
  sendData(res, toAchievementDTO(achievement.toObject()))
}

/** POST /api/achievements/:id/approve */
export async function approveAchievement(req: Request, res: Response): Promise<void> {
  const achievement = await Achievement.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!achievement) throw notFound('Achievement not found')

  const body = req.body as { verificationStatus: string; evidence?: string }

  achievement.verificationStatus = body.verificationStatus as never
  achievement.approvedAt = body.verificationStatus === 'verified' ? new Date() : null
  if (body.evidence !== undefined) achievement.evidence = body.evidence
  if (body.verificationStatus === 'verified' && achievement.sourceType === 'auto_suggested') {
    achievement.sourceType = 'verified'
  }

  await achievement.save()

  await recordActivity({
    userId: req.user!.id,
    eventType: 'achievement_approved',
    entityType: 'Achievement',
    entityId: achievement._id,
    metadata: { title: achievement.title, status: achievement.verificationStatus },
  })

  sendData(res, toAchievementDTO(achievement.toObject()))
}

/** DELETE /api/achievements/:id */
export async function deleteAchievement(req: Request, res: Response): Promise<void> {
  const achievement = await Achievement.findOne({ _id: req.params.id, userId: req.user!.id })
  if (!achievement) throw notFound('Achievement not found')
  await achievement.deleteOne()
  sendData(res, { message: 'Achievement deleted' })
}

