import mongoose, { Schema, type InferSchemaType, type HydratedDocument } from 'mongoose'

export const userAccountStatuses = ['active', 'deactivated', 'deleted'] as const
export type UserAccountStatus = (typeof userAccountStatuses)[number]

const profileSchema = new Schema(
  {
    avatarUrl: { type: String, trim: true, default: null },
    targetRole: { type: String, trim: true, default: null },
    targetCompanies: { type: [String], default: [] },
    graduationYear: { type: Number, default: null },
    phone: { type: String, trim: true, default: null },
    location: { type: String, trim: true, default: null },
    links: {
      type: [
        {
          _id: false,
          label: { type: String, trim: true, default: '' },
          url: { type: String, trim: true, default: '' },
        },
      ],
      default: [],
    },
  },
  { _id: false },
)

const studyPreferencesSchema = new Schema(
  {
    dailyGoalMinutes: { type: Number, default: 60, min: 0 },
    dailyGoalQuestions: { type: Number, default: 10, min: 0 },
    preferredSessionType: {
      type: String,
      enum: ['study', 'practice', 'revision', 'mock'],
      default: 'study',
    },
    timezone: { type: String, default: 'UTC' },
    weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
  },
  { _id: false },
)

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpiresAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null },
    profile: { type: profileSchema, default: () => ({}) },
    studyPreferences: { type: studyPreferencesSchema, default: () => ({}) },
    accountStatus: {
      type: String,
      enum: userAccountStatuses,
      default: 'active',
      index: true,
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    lastLoginAt: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>
export type UserLean = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId }

export const User = mongoose.model('User', userSchema)
