/**
 * Shared helpers for turning Mongoose documents into the exact JSON shapes
 * the frontend expects (`src/types/model.ts`).
 */

export type DocLike = Record<string, unknown>

export function idOf(doc: DocLike): string {
  return String(doc._id ?? doc.id)
}

export function iso(date: unknown): string | null {
  if (!date) return null
  return new Date(date as string).toISOString()
}

/** Maps a Subject document onto the frontend's `Subject` interface. */
export function toSubjectDTO(
  doc: DocLike,
  extras: { topicsCount?: number; questionsCount?: number; completionPercent?: number } = {},
) {
  return {
    id: idOf(doc),
    name: doc.name as string,
    slug: doc.slug as string,
    description: (doc.description as string | null) ?? null,
    category: (doc.category as string) ?? 'other',
    color: (doc.color as string | null) ?? null,
    icon: (doc.icon as string | null) ?? null,
    order: (doc.displayOrder as number) ?? 0,
    isActive: (doc.isActive as boolean) ?? true,
    topicsCount: extras.topicsCount,
    questionsCount: extras.questionsCount,
    completionPercent: extras.completionPercent,
  }
}

export function toTopicDTO(
  doc: DocLike,
  extras: { completionPercent?: number; questionsCount?: number; patternsCount?: number } = {},
) {
  return {
    id: idOf(doc),
    subjectId: String(doc.subjectId),
    name: doc.name as string,
    slug: doc.slug as string,
    description: (doc.description as string | null) ?? null,
    order: (doc.displayOrder as number) ?? 0,
    estimatedHours: (doc.estimatedHours as number | null) ?? null,
    difficulty: (doc.difficulty as string) ?? 'medium',
    prerequisites: ((doc.prerequisites as unknown[]) ?? []).map(String),
    learningObjectives: (doc.learningObjectives as string[]) ?? [],
    completionPercent: extras.completionPercent,
    questionsCount: extras.questionsCount,
    patternsCount: extras.patternsCount,
  }
}

export function toSubtopicDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    topicId: String(doc.topicId),
    name: doc.name as string,
    slug: doc.slug as string,
    order: (doc.displayOrder as number) ?? 0,
    notes: (doc.notes as string | null) ?? null,
  }
}

export function toPatternDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    topicId: String(doc.topicId),
    name: doc.name as string,
    description: (doc.description as string | null) ?? null,
    difficulty: (doc.difficulty as string) ?? 'medium',
    keyIdeas: (doc.keyIdeas as string[]) ?? [],
  }
}

export function toQuestionDTO(doc: DocLike) {
  const attempts = (doc.attemptsCount as number) ?? 0
  const correct = (doc.correctCount as number) ?? 0
  return {
    id: idOf(doc),
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    subtopicId: doc.subtopicId ? String(doc.subtopicId) : null,
    patternId: doc.patternId ? String(doc.patternId) : null,
    title: doc.title as string,
    body: (doc.body as string | null) ?? null,
    type: (doc.type as string) ?? 'text',
    difficulty: (doc.difficulty as string) ?? 'medium',
    options: (doc.options as unknown[]) ?? [],
    correctAnswer: doc.correctAnswer ?? null,
    explanation: (doc.explanation as string | null) ?? null,
    timeLimitSeconds: (doc.timeLimitSeconds as number | null) ?? null,
    tags: (doc.tags as string[]) ?? [],
    isFavorite: (doc.isFavorite as boolean) ?? false,
    status: (doc.status as string) ?? 'todo',
    attemptsCount: attempts,
    accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
    lastAttemptedAt: iso(doc.lastAttemptedAt),
    createdAt: iso(doc.createdAt),
  }
}

export function toAttemptDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    questionId: String(doc.questionId),
    userId: String(doc.userId),
    answer: doc.answer ?? null,
    isCorrect: (doc.isCorrect as boolean) ?? false,
    timeTakenSeconds: (doc.timeTakenSeconds as number | null) ?? null,
    createdAt: iso(doc.createdAt),
  }
}
