import { z } from 'zod'
import { objectIdSchema, paginationSchema } from './curriculum.validator'

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'skipped'])
export const taskPrioritySchema = z.enum(['low', 'medium', 'high'])

export const listTasksQuerySchema = paginationSchema.extend({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  subjectId: objectIdSchema.optional(),
  topicId: objectIdSchema.optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
})

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional(),
  subjectId: objectIdSchema.nullable().optional(),
  topicId: objectIdSchema.nullable().optional(),
  priority: taskPrioritySchema.default('medium'),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(1440).nullable().optional(),
})

export const updateTaskSchema = createTaskSchema
  .partial()
  .extend({ status: taskStatusSchema.optional() })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const createTaskLogSchema = z.object({
  taskId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  topicId: objectIdSchema.optional(),
  minutesSpent: z.number().int().min(0, 'Minutes spent cannot be negative').max(1440),
  questionsAttempted: z.number().int().min(0).max(1000).optional(),
  notes: z.string().trim().max(5000).optional(),
  loggedAt: z.string().datetime().optional(),
})

export const listTaskLogsQuerySchema = paginationSchema.extend({
  taskId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  topicId: objectIdSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const sessionTypeSchema = z.enum(['study', 'practice', 'revision', 'mock'])

export const createSessionSchema = z.object({
  subjectId: objectIdSchema.nullable().optional(),
  topicId: objectIdSchema.nullable().optional(),
  taskId: objectIdSchema.nullable().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  sessionType: sessionTypeSchema.default('study'),
  notes: z.string().trim().max(5000).optional(),
  /**
   * Client-generated key. Two requests with the same key must not create two
   * sessions, which makes retries safe.
   */
  idempotencyKey: z.string().trim().min(8, 'An idempotency key is required').max(200),
})

export const updateSessionSchema = z.object({
  subjectId: objectIdSchema.nullable().optional(),
  topicId: objectIdSchema.nullable().optional(),
  taskId: objectIdSchema.nullable().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  sessionType: sessionTypeSchema.optional(),
  notes: z.string().trim().max(5000).optional(),
})
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const listSessionsQuerySchema = paginationSchema.extend({
  subjectId: objectIdSchema.optional(),
  topicId: objectIdSchema.optional(),
  taskId: objectIdSchema.optional(),
  sessionType: sessionTypeSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const createRevisionSchema = z.object({
  topicId: objectIdSchema.nullable().optional(),
  subjectId: objectIdSchema.nullable().optional(),
  questionId: objectIdSchema.nullable().optional(),
  label: z.string().trim().min(1, 'A label is required').max(200),
  scheduledAt: z.string().datetime(),
  notes: z.string().trim().max(5000).optional(),
  intervalDays: z.number().int().min(1).max(365).default(1),
})

export const updateRevisionSchema = createRevisionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const listRevisionsQuerySchema = paginationSchema.extend({
  status: z.enum(['scheduled', 'due', 'completed', 'cancelled']).optional(),
  topicId: objectIdSchema.optional(),
  subjectId: objectIdSchema.optional(),
  dueOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
})

export const reviewRevisionSchema = z.object({
  /** Review quality on a 0–5 scale, as used by the SM-2 algorithm. */
  quality: z.number().int().min(0, 'Quality must be between 0 and 5').max(5),
  notes: z.string().trim().max(5000).optional(),
  confidenceAfter: z.number().int().min(0).max(100).optional(),
})
