import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { difficulties } from './subject.model'

export const questionTypes = ['mcq', 'multi', 'boolean', 'numeric', 'text', 'code'] as const
export type QuestionType = (typeof questionTypes)[number]

export const questionStatuses = ['todo', 'attempted', 'solved', 'skipped'] as const
export type QuestionStatus = (typeof questionStatuses)[number]

const questionOptionSchema = new Schema(
  {
    id: { type: String, default: null },
    text: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, default: false },
  },
  { _id: false },
)

const practiceQuestionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    subtopicId: { type: Schema.Types.ObjectId, ref: 'Subtopic', default: null, index: true },
    patternId: { type: Schema.Types.ObjectId, ref: 'Pattern', default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    body: { type: String, default: null },
    type: { type: String, enum: questionTypes, default: 'text', index: true },
    difficulty: { type: String, enum: difficulties, default: 'medium', index: true },
    options: { type: [questionOptionSchema], default: [] },
    correctAnswer: { type: Schema.Types.Mixed, default: null },
    explanation: { type: String, default: null },
    timeLimitSeconds: { type: Number, default: null },
    tags: { type: [String], default: [] },
    isFavorite: { type: Boolean, default: false, index: true },
    status: { type: String, enum: questionStatuses, default: 'todo', index: true },
    attemptsCount: { type: Number, default: 0 },
    solvedCount: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    lastAttemptedAt: { type: Date, default: null },
    personalNotes: { type: String, default: null },
    solutionReference: { type: String, default: null },
    source: { type: String, default: null },
    externalUrl: { type: String, default: null },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true },
)

practiceQuestionSchema.index({ userId: 1, createdAt: -1 })
practiceQuestionSchema.index({ userId: 1, status: 1 })
practiceQuestionSchema.index({ title: 'text', body: 'text' })

export type PracticeQuestionDocument = InferSchemaType<typeof practiceQuestionSchema>

export const PracticeQuestion = mongoose.model('PracticeQuestion', practiceQuestionSchema)

/**
 * An immutable record of one attempt at a question. Accuracy is computed from
 * these rows, never estimated.
 */
const questionAttemptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeQuestion',
      required: true,
      index: true,
    },
    answer: { type: Schema.Types.Mixed, default: null },
    isCorrect: { type: Boolean, required: true, index: true },
    timeTakenSeconds: { type: Number, default: null },
  },
  { timestamps: true },
)

questionAttemptSchema.index({ userId: 1, questionId: 1 })

export type QuestionAttemptDocument = InferSchemaType<typeof questionAttemptSchema>

export const QuestionAttempt = mongoose.model('QuestionAttempt', questionAttemptSchema)
