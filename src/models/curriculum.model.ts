import mongoose, { Schema, type InferSchemaType } from 'mongoose'
import { difficulties } from './subject.model'

/**
 * Subtopics are the second level of the topic hierarchy. The frontend exposes
 * them at `/topics/:topicId/subtopics`.
 */
const subtopicSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true },
    notes: { type: String, trim: true, default: null },
    displayOrder: { type: Number, default: 0, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true },
)

subtopicSchema.index({ topicId: 1, displayOrder: 1 })

export type SubtopicDocument = InferSchemaType<typeof subtopicSchema>

export const Subtopic = mongoose.model('Subtopic', subtopicSchema)

/**
 * Reusable solution patterns attached to a topic, surfaced at
 * `/topics/:topicId/patterns`.
 */
const patternSchema = new Schema(
  {
    topicId: { type: Schema.Types.ObjectId, ref: 'Topic', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, default: null },
    difficulty: { type: String, enum: difficulties, default: 'medium' },
    keyIdeas: { type: [String], default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true },
)

export type PatternDocument = InferSchemaType<typeof patternSchema>

export const Pattern = mongoose.model('Pattern', patternSchema)
