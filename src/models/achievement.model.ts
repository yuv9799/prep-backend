import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const verificationStatuses = ['pending', 'verified', 'rejected'] as const
export type VerificationStatus = (typeof verificationStatuses)[number]

export const achievementSources = ['user_entered', 'auto_suggested', 'verified'] as const
export type AchievementSource = (typeof achievementSources)[number]

const achievementSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null },
    category: { type: String, trim: true, default: null, index: true },
    icon: { type: String, default: null },
    points: { type: Number, default: 0 },
    evidence: { type: String, default: null },
    sourceType: { type: String, enum: achievementSources, default: 'user_entered' },
    sourceId: { type: Schema.Types.ObjectId, default: null },
    verificationStatus: {
      type: String,
      enum: verificationStatuses,
      default: 'pending',
      index: true,
    },
    approvedAt: { type: Date, default: null },
    earnedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
)

achievementSchema.index({ userId: 1, earnedAt: -1 })

export type AchievementDocument = InferSchemaType<typeof achievementSchema>

export const Achievement = mongoose.model('Achievement', achievementSchema)
