import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const progressStatuses = ['not_started', 'in_progress', 'completed'] as const
export type ProgressStatus = (typeof progressStatuses)[number]

const topicProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    status: { type: String, enum: progressStatuses, default: 'not_started', index: true },
    confidence: { type: Number, default: 0, min: 0, max: 100 },
    estimatedStudyMinutes: { type: Number, default: 0 },
    actualStudyMinutes: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastReviewedAt: { type: Date, default: null },
    nextReviewAt: { type: Date, default: null, index: true },
    revisionCount: { type: Number, default: 0 },
    notes: { type: String, default: null },
  },
  { timestamps: true },
)

// One progress row per user per topic.
topicProgressSchema.index({ userId: 1, topicId: 1 }, { unique: true })

export type TopicProgressDocument = InferSchemaType<typeof topicProgressSchema>

export const TopicProgress = mongoose.model('TopicProgress', topicProgressSchema)
