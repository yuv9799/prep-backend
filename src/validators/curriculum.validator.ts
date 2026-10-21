import { z } from 'zod'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')

export const idParamsSchema = z.object({ id: objectIdSchema })

export const objectIdParamsSchema = idParamsSchema

export const subjectIdParamsSchema = z.object({ subjectId: objectIdSchema })

export const topicIdParamsSchema = z.object({ topicId: objectIdSchema })

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().trim().max(40).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().max(120).optional(),
})

export const subjectCategorySchema = z.enum([
  'dsa',
  'core',
  'aptitude',
  'db',
  'os',
  'cn',
  'other',
])

export const difficultySchema = z.enum(['easy', 'medium', 'hard'])

export const createSubjectSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  category: subjectCategorySchema.default('other'),
  color: z.string().trim().max(32).optional(),
  icon: z.string().trim().max(64).optional(),
  displayOrder: z.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
})

export const updateSubjectSchema = createSubjectSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
)

export const createTopicSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(160),
  description: z.string().trim().max(4000).optional(),
  subjectId: objectIdSchema,
  parentTopicId: objectIdSchema.nullable().optional(),
  difficulty: difficultySchema.default('medium'),
  prerequisites: z.array(objectIdSchema).max(20).default([]),
  displayOrder: z.number().int().min(0).max(100000).optional(),
  estimatedHours: z.number().min(0).max(10000).nullable().optional(),
  learningObjectives: z.array(z.string().trim().max(500)).max(50).default([]),
})

export const updateTopicSchema = createTopicSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const listTopicsQuerySchema = paginationSchema.extend({
  subjectId: objectIdSchema.optional(),
  parentTopicId: objectIdSchema.optional(),
  difficulty: difficultySchema.optional(),
})

export const listSubjectsQuerySchema = paginationSchema.extend({
  category: subjectCategorySchema.optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
})

export const progressStatusSchema = z.enum(['not_started', 'in_progress', 'completed'])

export const updateTopicProgressSchema = z.object({
  status: progressStatusSchema.optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  estimatedStudyMinutes: z.number().int().min(0).optional(),
  actualStudyMinutes: z.number().int().min(0).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  lastReviewedAt: z.string().datetime().optional(),
  nextReviewAt: z.string().datetime().optional(),
  revisionCount: z.number().int().min(0).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
})
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })
