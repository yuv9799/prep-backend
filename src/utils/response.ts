import type { Response } from 'express'

/**
 * Canonical success envelope used by the PrepForge API:
 *   { success: true, data: {...}, message: "..." }
 */
export interface SuccessEnvelope<T> {
  success: true
  data: T
  message: string
}

export function sendData<T>(
  res: Response,
  data: T,
  options?: { status?: number; message?: string } | number,
): Response {
  const status = typeof options === 'number' ? options : options?.status ?? 200
  const message = typeof options === 'number' ? 'Operation completed successfully' : options?.message ?? 'Operation completed successfully'
  const body: SuccessEnvelope<T> = { success: true, data, message }
  return res.status(status).json(body)
}

export function sendMessage(res: Response, message: string, status = 200): Response {
  return res.status(status).json({ success: true, data: { message }, message })
}

export interface PaginatedPayload<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function sendPaginated<T>(
  res: Response,
  items: T[],
  total: number,
  page: number,
  pageSize: number,
  options?: { message?: string },
): Response {
  const body: SuccessEnvelope<PaginatedPayload<T>> = {
    success: true,
    data: { items, total, page, pageSize },
    message: options?.message ?? 'Operation completed successfully',
  }
  return res.status(200).json(body)
}
