import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const taskStatuses = ['todo', 'in_progress', 'done', 'skipped'] as const
export type TaskStatus = (typeof taskStatuses)[number]

export const taskPriorities = ['low', 'medium', 'high'] as const
export type TaskPriority = (typeof taskPriorities)[number]

const studyTaskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    priority: { type: String, enum: taskPriorities, default: 'medium', index: true },
    dueDate: { type: Date, default: null, index: true },
    estimatedMinutes: { type: Number, default: null },
    status: { type: String, enum: taskStatuses, default: 'todo', index: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

studyTaskSchema.index({ userId: 1, status: 1 })
studyTaskSchema.index({ userId: 1, dueDate: 1 })

export type StudyTaskDocument = InferSchemaType<typeof studyTaskSchema>

export const StudyTask = mongoose.model('StudyTask', studyTaskSchema)

/**
 * A log of time spent. `minutesSpent` is the unit the frontend expects; it is
 * derived from the session duration when a session is linked.
 */
const taskLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'StudyTask', default: null, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', default: null, index: true },
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    minutesSpent: { type: Number, required: true, min: 0 },
    questionsAttempted: { type: Number, default: 0 },
    notes: { type: String, default: null },
    loggedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
)

taskLogSchema.index({ userId: 1, loggedAt: -1 })

export type TaskLogDocument = InferSchemaType<typeof taskLogSchema>

export const TaskLog = mongoose.model('TaskLog', taskLogSchema)
