import mongoose, { Schema, type InferSchemaType } from 'mongoose'

/**
 * Append-only activity feed used for the progress timeline. Metadata must
 * never contain secrets; the service layer sanitises before writing.
 */
const activityEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    eventType: { type: String, required: true, trim: true, index: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
)

activityEventSchema.index({ userId: 1, createdAt: -1 })

export type ActivityEventDocument = InferSchemaType<typeof activityEventSchema>

export const ActivityEvent = mongoose.model('ActivityEvent', activityEventSchema)
