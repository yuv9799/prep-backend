import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const sessionTypes = ['study', 'practice', 'revision', 'mock'] as const
export type SessionType = (typeof sessionTypes)[number]

/**
 * A timed study session. `idempotencyKey` makes retries safe: a unique index
 * ensures a duplicate POST cannot create a second session.
 */
const studySessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'StudyTask', default: null, index: true },
    startedAt: { type: Date, required: true, index: true },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 },
    sessionType: { type: String, enum: sessionTypes, default: 'study' },
    notes: { type: String, default: null },
    idempotencyKey: { type: String, required: true },
  },
  { timestamps: true },
)

// Scoped per user so two users may reuse the same client-generated key.
studySessionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true })
studySessionSchema.index({ userId: 1, startedAt: -1 })

export type StudySessionDocument = InferSchemaType<typeof studySessionSchema>

export const StudySession = mongoose.model('StudySession', studySessionSchema)
