import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, registerUser } from './test-helpers'
import { startTestDatabase, stopTestDatabase } from './test-db'
import { TaskLog } from '../models/task.model'
import { QuestionAttempt, PracticeQuestion } from '../models/question.model'
import { Subject } from '../models/subject.model'

describe('analytics', () => {
  let token: string
  let userId: string

  beforeAll(async () => {
    await startTestDatabase()
    const user = await registerUser('analytics@example.com')
    token = user.token
    userId = user.userId

    const subject = await Subject.create({ name: 'Arrays', slug: 'arrays', category: 'dsa' })

    const question = await PracticeQuestion.create({
      userId,
      subjectId: subject._id,
      title: 'Reverse a linked list',
      type: 'text',
    })

    // Two attempts: one correct, one wrong.
    await QuestionAttempt.create({ userId, questionId: question._id, isCorrect: true })
    await QuestionAttempt.create({ userId, questionId: question._id, isCorrect: false })

    await TaskLog.create({ userId, minutesSpent: 45, questionsAttempted: 2 })
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('returns a dashboard summary', async () => {
    const response = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.questionsSolvedToday).toBe(2)
    expect(response.body.data.minutesStudiedToday).toBe(45)
    expect(response.body.data.accuracyToday).toBe(50)
    expect(response.body.data.streakDays).toBe(1)
    expect(Array.isArray(response.body.data.subjects)).toBe(true)
  })

  it('returns an analytics overview', async () => {
    const response = await request(app)
      .get('/api/analytics/overview')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.totalQuestionsSolved).toBe(2)
    expect(response.body.data.overallAccuracy).toBe(50)
    expect(response.body.data.totalMinutes).toBe(45)
    expect(response.body.data.currentStreak).toBe(1)
    expect(response.body.data.accuracyTrend.length).toBe(30)
  })

  it('returns a per-day activity series', async () => {
    const response = await request(app)
      .get('/api/analytics/activity?days=7')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(7)
    expect(response.body.data[6].minutes).toBe(45)
    expect(response.body.data[6].questions).toBe(2)
  })

  it('returns per-subject progress', async () => {
    const response = await request(app)
      .get('/api/analytics/subjects')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThan(0)
    expect(response.body.data[0].subjectName).toBe('Arrays')
    expect(response.body.data[0].questionsSolved).toBe(1)
  })

  it('requires authentication', async () => {
    const response = await request(app).get('/api/analytics/dashboard')
    expect(response.status).toBe(401)
  })

  it('rejects an out-of-range day window', async () => {
    const response = await request(app)
      .get('/api/analytics/activity?days=9999')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(422)
  })
})
