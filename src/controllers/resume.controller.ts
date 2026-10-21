import type { Request, Response } from 'express'
import { Resume, ResumeProposal, ResumeVersion } from '../models/resume.model'
import { User } from '../models/user.model'
import { notFound, badRequest } from '../utils/errors'
import { sendData, sendPaginated } from '../utils/response'
import { toProposalDTO, toResumeDTO } from '../utils/mappers.task'
import { buildResumeSummary, buildSuggestions } from '../services/resume-intelligence.service'
import { recordActivity } from '../services/activity.service'

/**
 * Returns the caller's default resume, creating an empty one on first use.
 * The editor must remain usable even when there is no learning data yet.
 */
export async function getDraft(req: Request, res: Response): Promise<void> {
  let resume = await Resume.findOne({ userId: req.user!.id, isDefault: true }).lean()

  if (!resume) {
    const created = await Resume.create({
      userId: req.user!.id,
      title: 'My Resume',
      isDefault: true,
    })
    resume = created.toObject()
  }

  sendData(res, toResumeDTO(resume))
}

/** GET /api/resumes — all drafts owned by the caller. */
export async function listDrafts(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { page: number; pageSize: number }

  const [items, total] = await Promise.all([
    Resume.find({ userId: req.user!.id })
      .sort({ updatedAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    Resume.countDocuments({ userId: req.user!.id }),
  ])

  sendPaginated(res, items.map(toResumeDTO), total, query.page, query.pageSize)
}

/** POST /api/resumes — creates an additional draft. */
export async function createDraft(req: Request, res: Response): Promise<void> {
  const body = req.body as { title?: string; targetRole?: string; template?: string }

  const resume = await Resume.create({
    userId: req.user!.id,
    title: body.title ?? 'My Resume',
    targetRole: body.targetRole ?? null,
    template: body.template ?? 'classic',
    isDefault: false,
  })

  sendData(res, toResumeDTO(resume.toObject()), 201)
}

/**
 * PATCH /api/resume
 *
 * Updates the default resume. A version snapshot is written first so the
 * previous state is not lost.
 */
export async function updateDraft(req: Request, res: Response): Promise<void> {
  const resume = await Resume.findOne({ userId: req.user!.id, isDefault: true })
  if (!resume) throw notFound('Resume not found')

  // Snapshot the current state before mutating it.
  await ResumeVersion.create({
    userId: req.user!.id,
    resumeId: resume._id,
    version: resume.version,
    snapshot: resume.toObject(),
  })

  const body = req.body as Record<string, unknown>
  const mutable = [
    'title',
    'targetRole',
    'template',
    'profileName',
    'headline',
    'summary',
    'email',
    'phone',
    'location',
    'links',
    'education',
    'experience',
    'projects',
    'skills',
    'certifications',
    'sectionOrder',
  ]

  for (const field of mutable) {
    if (body[field] !== undefined) {
      ;(resume as unknown as Record<string, unknown>)[field] = body[field]
    }
  }

  resume.version = (resume.version ?? 1) + 1
  await resume.save()

  sendData(res, toResumeDTO(resume.toObject()))
}

/** DELETE /api/resume */
export async function deleteDraft(req: Request, res: Response): Promise<void> {
  const resume = await Resume.findOne({ userId: req.user!.id, isDefault: true })
  if (!resume) throw notFound('Resume not found')

  await Promise.all([
    ResumeVersion.deleteMany({ resumeId: resume._id, userId: req.user!.id }),
    resume.deleteOne(),
  ])

  sendData(res, { message: 'Resume deleted' })
}

/** GET /api/resume/versions */
export async function listVersions(req: Request, res: Response): Promise<void> {
  const resume = await Resume.findOne({ userId: req.user!.id, isDefault: true }).lean()
  if (!resume) throw notFound('Resume not found')

  const versions = await ResumeVersion.find({ resumeId: resume._id, userId: req.user!.id })
    .sort({ version: -1 })
    .lean()

  sendData(
    res,
    versions.map((v) => ({
      id: String(v._id),
      version: v.version,
      createdAt: v.createdAt?.toISOString(),
    })),
  )
}


/**
 * Sub-resource handling for the resume's array fields.
 *
 * Each collection is stored inline on the resume document. Items are given a
 * stable generated `id` so the frontend can address them individually.
 */

type CollectionName =
  | 'education'
  | 'experience'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'links'

const COLLECTIONS: CollectionName[] = [
  'education',
  'experience',
  'projects',
  'skills',
  'certifications',
  'links',
]

function isCollection(name: string): name is CollectionName {
  return (COLLECTIONS as string[]).includes(name)
}

async function loadDefaultResume(userId: string) {
  const resume = await Resume.findOne({ userId, isDefault: true })
  if (!resume) throw notFound('Resume not found')
  return resume
}

function generateItemId(): string {
  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** GET /api/resume/:collection */
export async function listCollection(req: Request, res: Response): Promise<void> {
  const collection = req.params.collection
  if (!isCollection(collection)) throw badRequest('Unknown resume collection')

  const resume = await loadDefaultResume(req.user!.id)
  const items = (resume[collection] as unknown[]) ?? []
  sendData(res, items)
}

/** POST /api/resume/:collection */
export async function createCollectionItem(req: Request, res: Response): Promise<void> {
  const collection = req.params.collection
  if (!isCollection(collection)) throw badRequest('Unknown resume collection')

  const resume = await loadDefaultResume(req.user!.id)
  const items = [...((resume[collection] as unknown[]) ?? [])]
  const item = { id: generateItemId(), ...(req.body as Record<string, unknown>) }
  items.push(item)

  ;(resume as unknown as Record<string, unknown>)[collection] = items
  resume.version = (resume.version ?? 1) + 1
  await resume.save()

  sendData(res, item, 201)
}

/** PATCH /api/resume/:collection/:itemId */
export async function updateCollectionItem(req: Request, res: Response): Promise<void> {
  const collection = req.params.collection
  if (!isCollection(collection)) throw badRequest('Unknown resume collection')

  const resume = await loadDefaultResume(req.user!.id)
  const items = [...((resume[collection] as unknown[]) ?? [])]
  const index = items.findIndex((item) => (item as { id?: string }).id === req.params.itemId)
  if (index === -1) throw notFound('Resume item not found')

  // Merge rather than replace so partial updates keep the other fields.
  items[index] = { ...(items[index] as object), ...(req.body as Record<string, unknown>) }

  ;(resume as unknown as Record<string, unknown>)[collection] = items
  resume.version = (resume.version ?? 1) + 1
  await resume.save()

  sendData(res, items[index])
}

/** DELETE /api/resume/:collection/:itemId */
export async function deleteCollectionItem(req: Request, res: Response): Promise<void> {
  const collection = req.params.collection
  if (!isCollection(collection)) throw badRequest('Unknown resume collection')

  const resume = await loadDefaultResume(req.user!.id)
  const items = [...((resume[collection] as unknown[]) ?? [])]
  const index = items.findIndex((item) => (item as { id?: string }).id === req.params.itemId)
  if (index === -1) throw notFound('Resume item not found')

  items.splice(index, 1)
  ;(resume as unknown as Record<string, unknown>)[collection] = items
  resume.version = (resume.version ?? 1) + 1
  await resume.save()

  sendData(res, { message: 'Resume item deleted' })
}

/** GET /api/resume/proposals */
export async function listProposals(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as { page: number; pageSize: number; status?: string }

  const filter: Record<string, unknown> = { userId: req.user!.id }
  if (query.status) filter.status = query.status

  const [items, total] = await Promise.all([
    ResumeProposal.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean(),
    ResumeProposal.countDocuments(filter),
  ])

  sendPaginated(res, items.map(toProposalDTO), total, query.page, query.pageSize)
}

/**
 * POST /api/resume/proposals
 *
 * Creates a proposal. The proposal is *not* applied to the resume — it must
 * be accepted explicitly.
 */
export async function createProposal(req: Request, res: Response): Promise<void> {
  const body = req.body as { field: string; proposedValue: string; rationale?: string }

  const resume = await Resume.findOne({ userId: req.user!.id, isDefault: true }).lean()
  const currentValue = resume ? readField(resume, body.field) : ''

  const proposal = await ResumeProposal.create({
    userId: req.user!.id,
    resumeId: resume?._id ?? null,
    field: body.field,
    currentValue,
    proposedValue: body.proposedValue,
    rationale: body.rationale ?? null,
    status: 'pending',
  })

  sendData(res, toProposalDTO(proposal.toObject()), 201)
}

/**
 * PATCH /api/resume/proposals/:id
 *
 * Accepting a proposal applies its value to the resume field. Rejecting it
 * leaves the resume untouched.
 */
export async function decideProposal(req: Request, res: Response): Promise<void> {
  const proposal = await ResumeProposal.findOne({
    _id: req.params.id,
    userId: req.user!.id,
  })
  if (!proposal) throw notFound('Proposal not found')

  const body = req.body as { status: 'accepted' | 'rejected' }

  if (proposal.status !== 'pending') {
    throw badRequest('This proposal has already been decided')
  }

  proposal.status = body.status
  proposal.decidedAt = new Date()

  if (body.status === 'accepted') {
    const resume = await Resume.findOne({ userId: req.user!.id, isDefault: true })
    if (!resume) throw notFound('Resume not found')

    writeField(resume, proposal.field, proposal.proposedValue)
    resume.version = (resume.version ?? 1) + 1
    await resume.save()
  }

  await proposal.save()

  await recordActivity({
    userId: req.user!.id,
    eventType: body.status === 'accepted' ? 'proposal_accepted' : 'proposal_rejected',
    entityType: 'ResumeProposal',
    entityId: proposal._id,
    metadata: { field: proposal.field },
  })

  sendData(res, toProposalDTO(proposal.toObject()))
}

/**
 * GET /api/resume/suggestions
 *
 * Returns suggestions derived from the user's own records. Nothing is
 * written to the resume by this endpoint.
 */
export async function listSuggestions(req: Request, res: Response): Promise<void> {
  const [suggestions, summary] = await Promise.all([
    buildSuggestions(req.user!.id),
    buildResumeSummary(req.user!.id),
  ])

  sendData(res, { suggestions, summary })
}

/** Reads a field from a resume document as a string. */
function readField(resume: Record<string, unknown>, field: string): string {
  const value = resume[field]
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

/** Writes a field on a resume document. */
function writeField(
  resume: { set: (path: string, value: unknown) => void },
  field: string,
  value: string,
): void {
  resume.set(field, value)
}

