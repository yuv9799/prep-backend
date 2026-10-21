import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const revisionStatuses = ['scheduled', 'due', 'completed', 'cancelled'] as const
export type RevisionStatus = (typeof revisionStatuses)[number]

/**
 * A scheduled review of a topic (or a specific question). `intervalDays`,
 * `easeFactor` and `repetitions` implement a spaced-repetition schedule that
 * is advanced by the review endpoint.
 */
const revisionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: 'PracticeQuestion', default: null, index: true },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    scheduledAt: { type: Date, required: true, index: true },
    completedAt: { type: Date, default: null },
    confidenceBefore: { type: Number, default: null, min: 0, max: 100 },
    confidenceAfter: { type: Number, default: null, min: 0, max: 100 },
    notes: { type: String, default: null },
    status: { type: String, enum: revisionStatuses, default: 'scheduled', index: true },
    intervalDays: { type: Number, default: 1 },
    easeFactor: { type: Number, default: 2.5 },
    repetitions: { type: Number, default: 0 },
    lapses: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

revisionSchema.index({ userId: 1, status: 1, scheduledAt: 1 })

export type RevisionDocument = InferSchemaType<typeof revisionSchema>

export const Revision = mongoose.model('Revision', revisionSchema)
