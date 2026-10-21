import { z } from 'zod'
import { paginationSchema } from './curriculum.validator'

export const resumeLinkSchema = z.object({
  label: z.string().trim().min(1, 'A label is required').max(100),
  url: z.string().trim().url('Enter a valid URL').max(2000),
})

export const educationEntrySchema = z.object({
  institution: z.string().trim().min(1, 'Institution is required').max(200),
  degree: z.string().trim().min(1, 'Degree is required').max(200),
  field: z.string().trim().max(200).optional(),
  startYear: z.union([z.number().int().min(1950).max(2100), z.string().trim().max(20)]).optional(),
  endYear: z.union([z.number().int().min(1950).max(2100), z.string().trim().max(20)]).optional(),
  grade: z.string().trim().max(100).optional(),
  location: z.string().trim().max(200).optional(),
})

export const experienceEntrySchema = z.object({
  company: z.string().trim().min(1, 'Company is required').max(200),
  role: z.string().trim().min(1, 'Role is required').max(200),
  startDate: z.string().trim().max(50).optional(),
  endDate: z.string().trim().max(50).optional(),
  current: z.boolean().optional(),
  location: z.string().trim().max(200).optional(),
  bullets: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
})

export const resumeProjectSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(200),
  description: z.string().trim().max(3000).optional(),
  techStack: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  link: z.string().trim().url('Enter a valid URL').max(2000).optional(),
  highlights: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
})

export const skillGroupSchema = z.object({
  category: z.string().trim().min(1, 'A category is required').max(100),
  skills: z.array(z.string().trim().min(1).max(100)).max(100),
})

export const certificationSchema = z.object({
  name: z.string().trim().min(1, 'A name is required').max(200),
  issuer: z.string().trim().max(200).optional(),
  issuedAt: z.string().trim().max(50).optional(),
  credentialId: z.string().trim().max(200).optional(),
  url: z.string().trim().url('Enter a valid URL').max(2000).optional(),
})

export const updateResumeSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    targetRole: z.string().trim().max(200).nullable().optional(),
    template: z.string().trim().max(50).optional(),
    profileName: z.string().trim().max(200).nullable().optional(),
    headline: z.string().trim().max(300).nullable().optional(),
    summary: z.string().trim().max(5000).nullable().optional(),
    email: z.string().trim().max(254).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    links: z.array(resumeLinkSchema).max(30).optional(),
    education: z.array(educationEntrySchema).max(20).optional(),
    experience: z.array(experienceEntrySchema).max(20).optional(),
    projects: z.array(resumeProjectSchema).max(30).optional(),
    skills: z.array(skillGroupSchema).max(30).optional(),
    certifications: z.array(certificationSchema).max(30).optional(),
    sectionOrder: z.array(z.string().trim().max(50)).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export const createProposalSchema = z.object({
  field: z.string().trim().min(1, 'A field is required').max(100),
  proposedValue: z.string().trim().min(1, 'A proposed value is required').max(5000),
  rationale: z.string().trim().max(2000).optional(),
})

export const listProposalsQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'accepted', 'rejected']).optional(),
})

export const decideProposalSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

export const listResumesQuerySchema = paginationSchema
