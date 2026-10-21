import type { Request, Response } from 'express'
import { z } from 'zod'
import {
  buildAnalyticsOverview,
  buildDailyActivity,
  buildDashboardSummary,
  buildSubjectProgress,
} from '../services/analytics.service'
import { sendData } from '../utils/response'

export const activityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

/** GET /api/analytics/overview */
export async function overview(req: Request, res: Response): Promise<void> {
  const { days } = req.query as unknown as { days: number }
  const data = await buildAnalyticsOverview(req.user!.id, days)
  sendData(res, data)
}

/** GET /api/analytics/dashboard */
export async function dashboard(req: Request, res: Response): Promise<void> {
  const data = await buildDashboardSummary(req.user!.id)
  sendData(res, data)
}

/** GET /api/analytics/activity */
export async function activity(req: Request, res: Response): Promise<void> {
  const { days } = req.query as unknown as { days: number }
  const data = await buildDailyActivity(req.user!.id, days)
  sendData(res, data)
}

/** GET /api/analytics/subjects */
export async function subjectProgress(req: Request, res: Response): Promise<void> {
  const data = await buildSubjectProgress(req.user!.id)
  sendData(res, data)
}
