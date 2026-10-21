/**
 * Spaced-repetition scheduling based on the SM-2 algorithm.
 *
 * `quality` is the caller's self-assessment of the review, 0–5:
 *   < 3  → the item was forgotten; the interval resets and a lapse is recorded
 *   >= 3 → the item was recalled; the interval grows
 *
 * The algorithm is deterministic, so the same sequence of reviews always
 * produces the same schedule.
 */
export interface ScheduleState {
  intervalDays: number
  easeFactor: number
  repetitions: number
  lapses: number
}

export interface ScheduleResult extends ScheduleState {
  nextReviewAt: Date
}

const MIN_EASE = 1.3
const MAX_INTERVAL_DAYS = 365

export function scheduleNextReview(
  state: ScheduleState,
  quality: number,
  from: Date = new Date(),
): ScheduleResult {
  const q = Math.max(0, Math.min(5, Math.round(quality)))

  let { easeFactor, repetitions, lapses } = state
  let intervalDays: number

  if (q < 3) {
    // Forgotten: restart the schedule.
    repetitions = 0
    lapses = lapses + 1
    intervalDays = 1
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
  } else {
    repetitions = repetitions + 1
    if (repetitions === 1) {
      intervalDays = 1
    } else if (repetitions === 2) {
      intervalDays = 6
    } else {
      intervalDays = Math.round(state.intervalDays * easeFactor)
    }
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = Math.max(MIN_EASE, easeFactor)
  }

  intervalDays = Math.max(1, Math.min(MAX_INTERVAL_DAYS, intervalDays))

  const nextReviewAt = new Date(from)
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays)

  return { intervalDays, easeFactor, repetitions, lapses, nextReviewAt }
}
