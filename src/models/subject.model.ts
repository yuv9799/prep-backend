import mongoose, { Schema, type InferSchemaType } from 'mongoose'

export const difficulties = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof difficulties)[number]

export const subjectCategories = [
  'dsa',
  'core',
  'aptitude',
  'db',
  'os',
  'cn',
  'other',
] as const

const subjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code: { type: String, trim: true, maxlength: 20, default: null },
    description: { type: String, trim: true, default: null },
    category: { type: String, enum: subjectCategories, default: 'other', index: true },
    color: { type: String, trim: true, default: null },
    icon: { type: String, trim: true, default: null },
    displayOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
    /** Custom subjects are user-created; shared subjects have a null owner. */
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true },
)

export type SubjectDocument = InferSchemaType<typeof subjectSchema>

export const Subject = mongoose.model('Subject', subjectSchema)
