import { TopicProgress } from '../models/topic-progress.model'
import { PracticeQuestion, QuestionAttempt } from '../models/question.model'
import { StudyTask, TaskLog } from '../models/task.model'
import { StudySession } from '../models/study-session.model'
import { Revision } from '../models/revision.model'
import { Project } from '../models/project.model'
import { Achievement } from '../models/achievement.model'
import { Resume, ResumeProposal, ResumeVersion } from '../models/resume.model'
import { ActivityEvent } from '../models/activity-event.model'
import { Topic, Subtopic, Pattern } from '../models/index'
import { logger } from '../config/logger'

/**
 * Removes every record owned by a user. Used when an account is permanently
 * deleted so no orphaned data remains.
 */
export async function deleteUserOwnedData(userId: string): Promise<void> {
  const id = userId

  await Promise.all([
    TopicProgress.deleteMany({ userId: id }),
    QuestionAttempt.deleteMany({ userId: id }),
    PracticeQuestion.deleteMany({ userId: id }),
    TaskLog.deleteMany({ userId: id }),
    StudyTask.deleteMany({ userId: id }),
    StudySession.deleteMany({ userId: id }),
    Revision.deleteMany({ userId: id }),
    Project.deleteMany({ userId: id }),
    Achievement.deleteMany({ userId: id }),
    ResumeVersion.deleteMany({ userId: id }),
    ResumeProposal.deleteMany({ userId: id }),
    Resume.deleteMany({ userId: id }),
    ActivityEvent.deleteMany({ userId: id }),
    // Custom curriculum the user created themselves.
    Pattern.deleteMany({ ownerId: id }),
    Subtopic.deleteMany({ ownerId: id }),
    Topic.deleteMany({ ownerId: id }),
  ])

  logger.info({ userId: id }, 'Deleted all user-owned records')
}
