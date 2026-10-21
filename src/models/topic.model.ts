import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { difficulties } from './subject.model'

/**
 * Topics form a hierarchy via `parentTopicId`. Shared curriculum topics have a
 * null owner; user-created topics are scoped to their owner.
 */
const topicSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, trim: true, default: null },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    parentTopicId: { type: Schema.Types.ObjectId, ref: 'Topic', default: null, index: true },
    difficulty: { type: String, enum: difficulties, default: 'medium' },
    prerequisites: { type: [Schema.Types.ObjectId], default: [] },
    displayOrder: { type: Number, default: 0, index: true },
    estimatedHours: { type: Number, default: null },
    learningObjectives: { type: [String], default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true },
)

topicSchema.index({ subjectId: 1, displayOrder: 1 })
topicSchema.index({ name: 'text', description: 'text' })

export type TopicDocument = InferSchemaType<typeof topicSchema>

export const Topic = mongoose.model('Topic', topicSchema)
