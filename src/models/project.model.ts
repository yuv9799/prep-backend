import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const projectStatuses = ['planned', 'in_progress', 'completed', 'archived'] as const
export type ProjectStatus = (typeof projectStatuses)[number]

const projectSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null },
    technologies: { type: [String], default: [] },
    githubUrl: { type: String, trim: true, default: null },
    demoUrl: { type: String, trim: true, default: null },
    repositoryUrl: { type: String, trim: true, default: null },
    status: { type: String, enum: projectStatuses, default: 'planned', index: true },
    startDate: { type: Date, default: null },
    completionDate: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    contributionDetails: { type: String, default: null },
    evidenceLinks: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
  },
  { timestamps: true },
)

projectSchema.index({ userId: 1, status: 1 })

export type ProjectDocument = InferSchemaType<typeof projectSchema>

export const Project = mongoose.model('Project', projectSchema)
