import { Router, type NextFunction, type Request, type Response } from 'express'
import * as controller from '../controllers/resume.controller'
import { asyncHandler, validate } from '../middleware/validate'
import { authGate } from '../middleware/auth.middleware'
import { z } from 'zod'
import { badRequest } from '../utils/errors'
import {
  certificationSchema,
  createProposalSchema,
  decideProposalSchema,
  educationEntrySchema,
  experienceEntrySchema,
  listProposalsQuerySchema,
  resumeLinkSchema,
  resumeProjectSchema,
  skillGroupSchema,
  updateResumeSchema,
} from '../validators/resume.validator'

const router = Router()

authGate(router)

const collectionSchema = z.object({
  collection: z.enum([
    'education',
    'experience',
    'projects',
    'skills',
    'certifications',
    'links',
  ]),
})

const collectionItemParamsSchema = collectionSchema.extend({
  itemId: z.string().trim().min(1).max(100),
})

const collectionBodies: Record<string, z.ZodObject<any>> = {
  education: educationEntrySchema,
  experience: experienceEntrySchema,
  projects: resumeProjectSchema,
  skills: skillGroupSchema,
  certifications: certificationSchema,
  links: resumeLinkSchema,
}

/**
 * Validates the body against the schema of the addressed collection.
 * PATCH accepts a partial version of the same schema.
 */
function validateCollectionBody(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const collection = (req.params as { collection?: string }).collection ?? ''
  const schema = collectionBodies[collection]
  if (!schema) {
    next(badRequest('Unknown resume collection'))
    return
  }
  validate({ body: schema })(req, res, next)
}

/** Same as above, but every field is optional (used by PATCH). */
function validateCollectionPatch(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const collection = (req.params as { collection?: string }).collection ?? ''
  const schema = collectionBodies[collection]
  if (!schema) {
    next(badRequest('Unknown resume collection'))
    return
  }
  validate({ body: schema.partial() })(req, res, next)
}

// ── The default draft ────────────────────────────────────────────────────
router.get('/resume', asyncHandler(controller.getDraft))
router.patch('/resume', validate({ body: updateResumeSchema }), asyncHandler(controller.updateDraft))
router.delete('/resume', asyncHandler(controller.deleteDraft))

// ── Additional drafts ────────────────────────────────────────────────────
router.get('/resumes', asyncHandler(controller.listDrafts))
router.post('/resumes', asyncHandler(controller.createDraft))

// ── Versions ─────────────────────────────────────────────────────────────
router.get('/resume/versions', asyncHandler(controller.listVersions))

// ── Suggestions and proposals ────────────────────────────────────────────
// These are declared before the `:collection` routes so the literal paths
// are not captured as a collection name.
router.get('/resume/suggestions', asyncHandler(controller.listSuggestions))
router.get(
  '/resume/proposals',
  validate({ query: listProposalsQuerySchema }),
  asyncHandler(controller.listProposals),
)
router.post(
  '/resume/proposals',
  validate({ body: createProposalSchema }),
  asyncHandler(controller.createProposal),
)
router.patch(
  '/resume/proposals/:id',
  validate({ body: decideProposalSchema }),
  asyncHandler(controller.decideProposal),
)

// ── Inline collections ───────────────────────────────────────────────────
router.get(
  '/resume/:collection',
  validate({ params: collectionSchema }),
  asyncHandler(controller.listCollection),
)
router.post(
  '/resume/:collection',
  validate({ params: collectionSchema }),
  validateCollectionBody,
  asyncHandler(controller.createCollectionItem),
)
router.patch(
  '/resume/:collection/:itemId',
  validate({ params: collectionItemParamsSchema }),
  validateCollectionPatch,
  asyncHandler(controller.updateCollectionItem),
)
router.delete(
  '/resume/:collection/:itemId',
  validate({ params: collectionItemParamsSchema }),
  asyncHandler(controller.deleteCollectionItem),
)

export default router
