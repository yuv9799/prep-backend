import { TopicProgress } from '../models/topic-progress.model'
import { Project } from '../models/project.model'
import { Achievement } from '../models/achievement.model'
import { Subject } from '../models/subject.model'
import { Topic } from '../models/topic.model'
import { PracticeQuestion } from '../models/question.model'

export interface ResumeSuggestion {
  /** The resume field the suggestion targets. */
  field: string
  /** The suggested text. */
  proposedValue: string
  /** Why this suggestion was made, and what evidence backs it. */
  rationale: string
  /** The record the suggestion was derived from. */
  sourceType: 'topic' | 'project' | 'achievement' | 'question'
  sourceId: string
  /** Whether the suggestion may be added to a resume without further review. */
  requiresApproval: boolean
}

/**
 * Builds resume suggestions from the user's own records.
 *
 * Rules enforced here:
 *  - A completed topic may only suggest a *learning milestone*. It is never
 *    presented as professional proficiency.
 *  - A project suggestion uses the project's real description and technology
 *    stack. No outcome metrics are invented.
 *  - Achievements are only suggested from records the user has already
 *    verified/approved.
 *  - Every suggestion requires explicit approval before it is added.
 */
export async function buildSuggestions(userId: string): Promise<ResumeSuggestion[]> {
  const suggestions: ResumeSuggestion[] = []

  // ── Learning milestones from completed topics ───────────────────────────
  const completedProgress = await TopicProgress.find({
    userId,
    status: 'completed',
  })
    .sort({ completedAt: -1 })
    .limit(25)
    .lean()

  if (completedProgress.length > 0) {
    const topicIds = completedProgress.map((p) => p.topicId)
    const topics = await Topic.find({ _id: { $in: topicIds } }).lean()
    const topicMap = new Map(topics.map((t) => [String(t._id), t]))

    const subjectIds = [...new Set(topics.map((t) => String(t.subjectId)))]
    const subjects = await Subject.find({ _id: { $in: subjectIds } }).lean()
    const subjectMap = new Map(subjects.map((s) => [String(s._id), s.name]))

    for (const progress of completedProgress) {
      const topic = topicMap.get(String(progress.topicId))
      if (!topic) continue
      const subjectName = subjectMap.get(String(topic.subjectId)) ?? 'a subject'

      suggestions.push({
        field: 'summary',
        proposedValue: `Completed the ${topic.name} module of the ${subjectName} curriculum, covering ${
          topic.learningObjectives?.length ?? 0
        } learning objectives through tracked study sessions and revision practice.`,
        rationale:
          'Derived from a topic you marked as completed. This states a learning milestone only — it is not a claim of professional experience.',
        sourceType: 'topic',
        sourceId: String(topic._id),
        requiresApproval: true,
      })
    }
  }

  // ── Projects ───────────────────────────────────────────────────────────
  const projects = await Project.find({ userId, status: 'completed' })
    .sort({ updatedAt: -1 })
    .limit(20)
    .lean()

  for (const project of projects) {
    const technologies = project.technologies ?? []
    const techPhrase =
      technologies.length > 0
        ? ` Built with ${technologies.join(', ')}.`
        : ''

    // The description is the user's own text; it is reused verbatim rather
    // than rewritten, so nothing is invented.
    const proposedValue = [
      project.description ? project.description.trim() : `Completed the project “${project.title}”.`,
      techPhrase,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    suggestions.push({
      field: 'projects',
      proposedValue,
      rationale: `Based on your own project record “${project.title}”. Only the description and technology stack you recorded are used — no metrics are inferred.`,
      sourceType: 'project',
      sourceId: String(project._id),
      requiresApproval: true,
    })
  }

  // ── Verified achievements ──────────────────────────────────────────────
  const achievements = await Achievement.find({
    userId,
    verificationStatus: 'verified',
  })
    .sort({ earnedAt: -1 })
    .limit(20)
    .lean()

  for (const achievement of achievements) {
    suggestions.push({
      field: 'achievements',
      proposedValue: achievement.description
        ? `${achievement.title} — ${achievement.description}`
        : achievement.title,
      rationale: `Based on the achievement “${achievement.title}” that you have already verified.`,
      sourceType: 'achievement',
      sourceId: String(achievement._id),
      requiresApproval: true,
    })
  }

  return suggestions
}

/**
 * Summarises the user's real activity for the resume page. No value is
 * invented: every number comes from a recorded attempt or session.
 */
export async function buildResumeSummary(userId: string) {
  const [questionStats] = await Promise.all([
    PracticeQuestion.aggregate<{
      total: number
      solved: number
      attempted: number
      correct: number
    }>([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          solved: { $sum: { $cond: [{ $eq: ['$status', 'solved'] }, 1, 0] } },
          attempted: { $sum: { $cond: [{ $eq: ['$status', 'attempted'] }, 1, 0] } },
          correct: { $sum: '$correctCount' },
        },
      },
    ]),
  ])

  const stats = questionStats[0] ?? { total: 0, solved: 0, attempted: 0, correct: 0 }

  return {
    questionsTracked: stats.total,
    questionsSolved: stats.solved,
    questionsAttempted: stats.attempted,
    topicsCompleted: await TopicProgress.countDocuments({ userId, status: 'completed' }),
    projectsCompleted: await Project.countDocuments({ userId, status: 'completed' }),
    verifiedAchievements: await Achievement.countDocuments({
      userId,
      verificationStatus: 'verified',
    }),
  }
}
