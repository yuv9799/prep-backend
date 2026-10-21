import { ActivityEvent } from '../models/activity-event.model'
import { logger } from '../config/logger'

/**
 * Keys whose values must never be written into activity metadata.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'verificationtoken',
  'secret',
  'authorization',
  'cookie',
])

/**
 * Removes sensitive values from metadata recursively so secrets can never
 * end up in the activity feed.
 */
export function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5) return undefined
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item, depth + 1))
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue
      const cleaned = sanitizeMetadata(val, depth + 1)
      if (cleaned !== undefined) result[key] = cleaned
    }
    return result
  }
  return value
}

export interface RecordActivityInput {
  userId: string
  eventType: string
  entityType: string
  entityId?: unknown
  metadata?: Record<string, unknown>
}

/**
 * Appends an event to the user's activity timeline.
 * Failures are logged but never propagate — an activity write must not break
 * the operation that triggered it.
 */
export async function recordActivity(input: RecordActivityInput): Promise<void> {
  try {
    await ActivityEvent.create({
      userId: input.userId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: sanitizeMetadata(input.metadata ?? {}) ?? {},
    })
  } catch (error) {
    logger.warn({ err: error, eventType: input.eventType }, 'Failed to record activity event')
  }
}
