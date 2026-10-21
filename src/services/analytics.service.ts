import { TopicProgress } from '../models/topic-progress.model'
import { PracticeQuestion, QuestionAttempt } from '../models/question.model'
import { TaskLog, StudyTask } from '../models/task.model'
import { Revision } from '../models/revision.model'
import { Subject } from '../models/subject.model'

/** A calendar day in `YYYY-MM-DD` form, in UTC. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Start of the UTC day `offset` days before today. */
function startOfUtcDay(daysBack: number): Date {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  start.setUTCDate(start.getUTCDate() - daysBack)
  return start
}

/**
 * Counts consecutive days (ending today or yesterday) that have activity.
 *
 * A streak stays alive when the most recent active day is today or yesterday,
 * so a user who has not studied yet today does not lose yesterday's streak
 * until the day after.
 */
export function computeStreak(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0

  const today = new Date()
  const cursor = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )

  // Allow the streak to start from today or yesterday.
  if (!activeDays.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1)
    if (!activeDays.has(dayKey(cursor))) return 0
  }

  let streak = 0
  while (activeDays.has(dayKey(cursor))) {
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

/** Per-day totals of minutes studied and questions solved. */
export interface DailyActivity {
  date: string
  minutes: number
  questions: number
}

export interface SubjectProgressRow {
  subjectId: string
  subjectName: string
  completionPercent: number
  questionsSolved: number
  questionsTotal: number
}


/**
 * Builds the per-day activity series for the last `days` days.
 *
 * Every day in the window is present so the chart has a continuous x-axis;
 * days without activity carry zeroes.
 */
export async function buildDailyActivity(
  userId: string,
  days: number,
): Promise<DailyActivity[]> {
  const since = startOfUtcDay(days - 1)

  const [logs, attempts] = await Promise.all([
    TaskLog.find({ userId, loggedAt: { $gte: since } }).lean(),
    QuestionAttempt.find({ userId, createdAt: { $gte: since } }).lean(),
  ])

  const buckets = new Map<string, DailyActivity>()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(startOfUtcDay(offset))
    buckets.set(dayKey(d), { date: dayKey(d), minutes: 0, questions: 0 })
  }

  for (const log of logs) {
    const key = dayKey(new Date(log.loggedAt as Date))
    const bucket = buckets.get(key)
    if (bucket) bucket.minutes += log.minutesSpent ?? 0
  }

  for (const attempt of attempts) {
    const key = dayKey(new Date(attempt.createdAt as Date))
    const bucket = buckets.get(key)
    if (bucket) bucket.questions += 1
  }

  return [...buckets.values()]
}


/** Aggregated progress per subject, ordered by the number of questions solved. */
export async function buildSubjectProgress(userId: string): Promise<SubjectProgressRow[]> {
  const [subjects, questions, progress] = await Promise.all([
    Subject.find({ $or: [{ ownerId: null }, { ownerId: userId }] }).lean(),
    PracticeQuestion.find({ userId }).lean(),
    TopicProgress.find({ userId }).lean(),
  ])

  const nameById = new Map(subjects.map((s) => [String(s._id), s.name as string]))

  const solvedBySubject = new Map<string, number>()
  for (const question of questions) {
    if (!question.subjectId) continue
    const key = String(question.subjectId)
    solvedBySubject.set(key, (solvedBySubject.get(key) ?? 0) + 1)
  }

  const completedBySubject = new Map<string, number>()
  for (const row of progress) {
    if (row.status !== 'completed') continue
    const key = String(row.subjectId)
    completedBySubject.set(key, (completedBySubject.get(key) ?? 0) + 1)
  }

  // Completion is the share of the subject's topics that are marked done.
  const topicTotals = await TopicProgress.aggregate<{ _id: unknown; total: number }>([
    { $match: { userId } },
    { $group: { _id: '$subjectId', total: { $sum: 1 } } },
  ])

  const topicTotalBySubject = new Map(topicTotals.map((t) => [String(t._id), t.total]))

  const rows: SubjectProgressRow[] = subjects.map((subject) => {
    const id = String(subject._id)
    const questionsSolved = solvedBySubject.get(id) ?? 0
    return {
      subjectId: id,
      subjectName: nameById.get(id) ?? 'Unknown',
      completionPercent: 0,
      questionsSolved,
      questionsTotal: questionsSolved,
    }
  })

  for (const row of rows) {
    const total = topicTotalBySubject.get(row.subjectId) ?? 0
    const completed = completedBySubject.get(row.subjectId) ?? 0
    row.completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0
  }

  return rows.sort((a, b) => b.questionsSolved - a.questionsSolved)
}


export interface AnalyticsOverview {
  totalQuestionsSolved: number
  overallAccuracy: number
  totalMinutes: number
  currentStreak: number
  longestStreak: number
  accuracyTrend: DailyActivity[]
  timeSeries: DailyActivity[]
  bySubject: SubjectProgressRow[]
}

export interface DashboardSummary {
  tasksCompletedToday: number
  minutesStudiedToday: number
  questionsSolvedToday: number
  accuracyToday: number
  revisionsDue: number
  streakDays: number
  subjects: SubjectProgressRow[]
}

/** The headline numbers shown on the dashboard. */
export async function buildDashboardSummary(
  userId: string,
): Promise<DashboardSummary> {
  const today = startOfUtcDay(0)

  const [tasksCompletedToday, logsToday, attemptsToday, attemptsAll, revisionsDue, daily] =
    await Promise.all([
      StudyTask.countDocuments({ userId, status: 'done', completedAt: { $gte: today } }),
      TaskLog.find({ userId, loggedAt: { $gte: today } }).lean(),
      QuestionAttempt.find({ userId, createdAt: { $gte: today } }).lean(),
      QuestionAttempt.find({ userId }).lean(),
      Revision.countDocuments({
        userId,
        status: { $in: ['scheduled', 'due'] },
        scheduledAt: { $lte: new Date() },
      }),
      buildDailyActivity(userId, 365),
    ])

  const minutesStudiedToday = logsToday.reduce(
    (sum, log) => sum + (log.minutesSpent ?? 0),
    0,
  )
  const questionsSolvedToday = attemptsToday.length
  const correctToday = attemptsToday.filter((a) => a.isCorrect).length
  const accuracyToday =
    attemptsToday.length > 0 ? Math.round((correctToday / attemptsToday.length) * 100) : 0

  const totalCorrect = attemptsAll.filter((a) => a.isCorrect).length
  const overallAccuracy =
    attemptsAll.length > 0 ? Math.round((totalCorrect / attemptsAll.length) * 100) : 0

  const activeDays = new Set(
    daily.filter((d) => d.minutes > 0 || d.questions > 0).map((d) => d.date),
  )

  return {
    tasksCompletedToday,
    minutesStudiedToday,
    questionsSolvedToday,
    accuracyToday,
    revisionsDue,
    streakDays: computeStreak(activeDays),
    subjects: await buildSubjectProgress(userId),
  }
}

/** The full analytics overview, including the trend series. */
export async function buildAnalyticsOverview(
  userId: string,
  days = 30,
): Promise<AnalyticsOverview> {
  const [daily, attemptsAll, logsAll, bySubject] = await Promise.all([
    buildDailyActivity(userId, days),
    QuestionAttempt.find({ userId }).lean(),
    TaskLog.find({ userId }).lean(),
    buildSubjectProgress(userId),
  ])

  const totalCorrect = attemptsAll.filter((a) => a.isCorrect).length
  const overallAccuracy =
    attemptsAll.length > 0 ? Math.round((totalCorrect / attemptsAll.length) * 100) : 0

  const totalMinutes = logsAll.reduce((sum, log) => sum + (log.minutesSpent ?? 0), 0)

  const activeDays = new Set(
    daily.filter((d) => d.minutes > 0 || d.questions > 0).map((d) => d.date),
  )

  return {
    totalQuestionsSolved: attemptsAll.length,
    overallAccuracy,
    totalMinutes,
    currentStreak: computeStreak(activeDays),
    longestStreak: computeStreak(activeDays),
    accuracyTrend: daily,
    timeSeries: daily,
    bySubject,
  }
}
