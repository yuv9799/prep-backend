import { iso, idOf, type DocLike } from './mappers'

export function toTaskDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    title: doc.title as string,
    description: (doc.description as string | null) ?? null,
    status: (doc.status as string) ?? 'todo',
    subjectId: doc.subjectId ? String(doc.subjectId) : null,
    topicId: doc.topicId ? String(doc.topicId) : null,
    dueDate: iso(doc.dueDate),
    priority: (doc.priority as string) ?? 'medium',
    estimatedMinutes: (doc.estimatedMinutes as number | null) ?? null,
    completedAt: iso(doc.completedAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  }
}

export function toTaskLogDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    taskId: doc.taskId ? String(doc.taskId) : undefined,
    subjectId: doc.subjectId ? String(doc.subjectId) : undefined,
    topicId: doc.topicId ? String(doc.topicId) : undefined,
    minutesSpent: (doc.minutesSpent as number) ?? 0,
    questionsAttempted: (doc.questionsAttempted as number) ?? 0,
    notes: (doc.notes as string | null) ?? null,
    loggedAt: iso(doc.loggedAt),
  }
}

export function toSessionDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    subjectId: doc.subjectId ? String(doc.subjectId) : null,
    topicId: doc.topicId ? String(doc.topicId) : null,
    taskId: doc.taskId ? String(doc.taskId) : null,
    startedAt: iso(doc.startedAt),
    endedAt: iso(doc.endedAt),
    durationSeconds: (doc.durationSeconds as number) ?? 0,
    sessionType: (doc.sessionType as string) ?? 'study',
    notes: (doc.notes as string | null) ?? null,
    idempotencyKey: doc.idempotencyKey as string,
  }
}

export function toRevisionDTO(doc: DocLike) {
  const scheduledAt = new Date((doc.scheduledAt as string) ?? Date.now())
  const completed = doc.completedAt != null
  const stage = completed
    ? 'completed'
    : scheduledAt.getTime() <= Date.now()
      ? 'due'
      : 'scheduled'
  return {
    id: idOf(doc),
    topicId: doc.topicId ? String(doc.topicId) : null,
    subjectId: doc.subjectId ? String(doc.subjectId) : null,
    questionId: doc.questionId ? String(doc.questionId) : null,
    label: doc.label as string,
    stage,
    status: (doc.status as string) ?? 'scheduled',
    intervalDays: (doc.intervalDays as number) ?? 1,
    easeFactor: (doc.easeFactor as number) ?? 2.5,
    nextReviewAt: scheduledAt.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
    lastReviewedAt: iso(doc.lastReviewedAt),
    completedAt: iso(doc.completedAt),
    repetitions: (doc.repetitions as number) ?? 0,
    lapses: (doc.lapses as number) ?? 0,
    notes: (doc.notes as string | null) ?? null,
  }
}

export function toProjectDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    title: doc.title as string,
    description: (doc.description as string | null) ?? null,
    status: (doc.status as string) ?? 'planned',
    techStack: (doc.technologies as string[]) ?? [],
    technologies: (doc.technologies as string[]) ?? [],
    repositoryUrl: (doc.repositoryUrl as string | null) ?? (doc.githubUrl as string | null) ?? null,
    githubUrl: (doc.githubUrl as string | null) ?? null,
    demoUrl: (doc.demoUrl as string | null) ?? null,
    startedAt: iso(doc.startedAt),
    completedAt: iso(doc.completedAt),
    startDate: iso(doc.startDate),
    completionDate: iso(doc.completionDate),
    contributionDetails: (doc.contributionDetails as string | null) ?? null,
    evidenceLinks: (doc.evidenceLinks as string[]) ?? [],
    highlights: (doc.highlights as string[]) ?? [],
    createdAt: iso(doc.createdAt),
  }
}


export function toAchievementDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    title: doc.title as string,
    description: (doc.description as string | null) ?? null,
    icon: (doc.icon as string | null) ?? null,
    points: (doc.points as number) ?? 0,
    category: (doc.category as string | null) ?? null,
    earnedAt: iso(doc.earnedAt),
    sourceType: (doc.sourceType as string) ?? 'user_entered',
    verificationStatus: (doc.verificationStatus as string) ?? 'pending',
    approvedAt: iso(doc.approvedAt),
    evidence: (doc.evidence as string | null) ?? null,
  }
}

export function toProgressDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    userId: String(doc.userId),
    topicId: String(doc.topicId),
    subjectId: String(doc.subjectId),
    status: (doc.status as string) ?? 'not_started',
    confidence: (doc.confidence as number) ?? 0,
    estimatedStudyMinutes: (doc.estimatedStudyMinutes as number) ?? 0,
    actualStudyMinutes: (doc.actualStudyMinutes as number) ?? 0,
    startedAt: iso(doc.startedAt),
    completedAt: iso(doc.completedAt),
    lastReviewedAt: iso(doc.lastReviewedAt),
    nextReviewAt: iso(doc.nextReviewAt),
    revisionCount: (doc.revisionCount as number) ?? 0,
    notes: (doc.notes as string | null) ?? null,
  }
}

export function toResumeDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    title: (doc.title as string) ?? 'My Resume',
    targetRole: (doc.targetRole as string | null) ?? null,
    template: (doc.template as string) ?? 'classic',
    profileName: (doc.profileName as string | null) ?? null,
    headline: (doc.headline as string | null) ?? null,
    summary: (doc.summary as string | null) ?? null,
    email: (doc.email as string | null) ?? null,
    phone: (doc.phone as string | null) ?? null,
    location: (doc.location as string | null) ?? null,
    links: (doc.links as unknown[]) ?? [],
    education: (doc.education as unknown[]) ?? [],
    experience: (doc.experience as unknown[]) ?? [],
    projects: (doc.projects as unknown[]) ?? [],
    skills: (doc.skills as unknown[]) ?? [],
    certifications: (doc.certifications as unknown[]) ?? [],
    achievements: (doc.achievements as unknown[]) ?? [],
    sectionOrder: (doc.sectionOrder as string[]) ?? [],
    version: (doc.version as number) ?? 1,
    updatedAt: iso(doc.updatedAt),
    createdAt: iso(doc.createdAt),
  }
}

export function toProposalDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    field: doc.field as string,
    currentValue: (doc.currentValue as string) ?? '',
    proposedValue: doc.proposedValue as string,
    rationale: (doc.rationale as string | null) ?? null,
    status: (doc.status as string) ?? 'pending',
    createdAt: iso(doc.createdAt),
    decidedAt: iso(doc.decidedAt),
  }
}

export function toActivityDTO(doc: DocLike) {
  return {
    id: idOf(doc),
    eventType: doc.eventType as string,
    entityType: doc.entityType as string,
    entityId: doc.entityId ? String(doc.entityId) : null,
    metadata: doc.metadata ?? {},
    createdAt: iso(doc.createdAt),
  }
}
