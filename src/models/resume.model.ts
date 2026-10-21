import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const proposalStatuses = ['pending', 'accepted', 'rejected'] as const
export type ProposalStatus = (typeof proposalStatuses)[number]

const resumeSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200, default: 'My Resume' },
    targetRole: { type: String, trim: true, default: null },
    template: { type: String, default: 'classic' },
    profileName: { type: String, default: null },
    headline: { type: String, default: null },
    summary: { type: String, default: null },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    location: { type: String, default: null },
    personalDetails: { type: Schema.Types.Mixed, default: () => ({}) },
    education: { type: [Schema.Types.Mixed], default: [] },
    skills: { type: [Schema.Types.Mixed], default: [] },
    projects: { type: [Schema.Types.Mixed], default: [] },
    experience: { type: [Schema.Types.Mixed], default: [] },
    certifications: { type: [Schema.Types.Mixed], default: [] },
    achievements: { type: [Schema.Types.Mixed], default: [] },
    links: { type: [Schema.Types.Mixed], default: [] },
    sectionOrder: {
      type: [String],
      default: () => ['summary', 'experience', 'projects', 'education', 'skills', 'certifications'],
    },
    version: { type: Number, default: 1 },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
)

resumeSchema.index({ userId: 1, updatedAt: -1 })

export type ResumeDocument = InferSchemaType<typeof resumeSchema>

export const Resume = mongoose.model('Resume', resumeSchema)

/**
 * An immutable snapshot of a resume at a given version. Written whenever a
 * resume is updated so history can be inspected and rolled back.
 */
const resumeVersionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
)

resumeVersionSchema.index({ userId: 1, resumeId: 1, version: 1 }, { unique: true })

export type ResumeVersionDocument = InferSchemaType<typeof resumeVersionSchema>

export const ResumeVersion = mongoose.model('ResumeVersion', resumeVersionSchema)

/**
 * A suggested change to a resume field. Suggestions are never applied to the
 * resume automatically — the user must accept them.
 */
const resumeProposalSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', default: null, index: true },
    field: { type: String, required: true, trim: true },
    currentValue: { type: String, default: '' },
    proposedValue: { type: String, required: true },
    rationale: { type: String, default: null },
    status: { type: String, enum: proposalStatuses, default: 'pending', index: true },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

resumeProposalSchema.index({ userId: 1, status: 1, createdAt: -1 })

export type ResumeProposalDocument = InferSchemaType<typeof resumeProposalSchema>

export const ResumeProposal = mongoose.model('ResumeProposal', resumeProposalSchema)
