import { z } from 'zod'
import {
  objectIdSchema,
  paginationSchema,
  difficultySchema,
  idParamsSchema,
} from './curriculum.validator'

export { idParamsSchema }

export const questionTypeSchema = z.enum(['mcq', 'multi', 'boolean', 'numeric', 'text', 'code'])

export const questionOptionSchema = z.object({
  id: z.string().trim().max(64).optional(),
  text: z.string().trim().min(1, 'Option text is required').max(1000),
  isCorrect: z.boolean().optional(),
})

export const listQuestionsQuerySchema = paginationSchema.extend({
  subjectId: objectIdSchema.optional(),
  topicId: objectIdSchema.optional(),
  subtopicId: objectIdSchema.optional(),
  patternId: objectIdSchema.optional(),
  difficulty: difficultySchema.optional(),
  type: questionTypeSchema.optional(),
  status: z.enum(['todo', 'attempted', 'solved', 'skipped']).optional(),
  favoriteOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  tags: z.string().trim().max(200).optional(),
})

export const createQuestionSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(300),
  body: z.string().trim().max(20000).optional(),
  subjectId: objectIdSchema.nullable().optional(),
  topicId: objectIdSchema.nullable().optional(),
  subtopicId: objectIdSchema.nullable().optional(),
  patternId: objectIdSchema.nullable().optional(),
  type: questionTypeSchema.default('text'),
  difficulty: difficultySchema.default('medium'),
  options: z.array(questionOptionSchema).max(20).default([]),
  correctAnswer: z.union([z.string(), z.number(), z.array(z.string()), z.null()]).optional(),
  explanation: z.string().trim().max(20000).optional(),
  timeLimitSeconds: z.number().int().min(5).max(7200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
  personalNotes: z.string().trim().max(20000).optional(),
  solutionReference: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(200).optional(),
  externalUrl: z.string().trim().url('Enter a valid URL').max(2000).optional(),
  confidence: z.number().int().min(0).max(100).optional(),
})

export const updateQuestionSchema = createQuestionSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const attemptQuestionSchema = z.object({
  answer: z.union([z.string(), z.number(), z.array(z.string()), z.null()]),
  timeTakenSeconds: z.number().int().min(0).max(86400).optional(),
})

export const favoriteQuestionSchema = z.object({
  favorite: z.boolean(),
})
