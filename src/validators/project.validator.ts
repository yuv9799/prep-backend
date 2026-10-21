import { z } from 'zod'
import { objectIdSchema, paginationSchema } from './curriculum.validator'

export const projectStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'archived'])

export const listProjectsQuerySchema = paginationSchema.extend({
  status: projectStatusSchema.optional(),
})

export const createProjectSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(200),
  description: z.string().trim().max(10000).optional(),
  technologies: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  githubUrl: z.string().trim().url('Enter a valid URL').max(2000).nullable().optional(),
  repositoryUrl: z.string().trim().url('Enter a valid URL').max(2000).nullable().optional(),
  demoUrl: z.string().trim().url('Enter a valid URL').max(2000).nullable().optional(),
  status: projectStatusSchema.default('planned'),
  startDate: z.string().datetime().nullable().optional(),
  completionDate: z.string().datetime().nullable().optional(),
  contributionDetails: z.string().trim().max(10000).optional(),
  evidenceLinks: z.array(z.string().trim().url('Enter a valid URL').max(2000)).max(30).default([]),
  highlights: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
})

export const updateProjectSchema = createProjectSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const listAchievementsQuerySchema = paginationSchema.extend({
  category: z.string().trim().max(80).optional(),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).optional(),
  sourceType: z.enum(['user_entered', 'auto_suggested', 'verified']).optional(),
})

export const createAchievementSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(80).optional(),
  icon: z.string().trim().max(64).optional(),
  points: z.number().int().min(0).max(10000).default(0),
  evidence: z.string().trim().max(5000).optional(),
  earnedAt: z.string().datetime().optional(),
  /**
   * `user_entered` and `auto_suggested` are the only values a client may
   * create; `verified` is set by the server on approval.
   */
  sourceType: z.enum(['user_entered', 'auto_suggested']).default('user_entered'),
})

export const updateAchievementSchema = createAchievementSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const approveAchievementSchema = z.object({
  verificationStatus: z.enum(['verified', 'rejected']).default('verified'),
  evidence: z.string().trim().max(5000).optional(),
})
