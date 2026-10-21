import request from 'supertest'
import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { app, registerUser } from './test-helpers'
import { startTestDatabase, stopTestDatabase } from './test-db'
import { StudySession } from '../models/study-session.model'
import { TopicProgress } from '../models/topic-progress.model'
import { Topic } from '../models/topic.model'
import { Subject } from '../models/subject.model'

describe('PATCH /api/sessions/:id', () => {
  let token: string
  let userId: string
  let otherUserId: string
  let sessionId: string

  beforeAll(async () => {
    await startTestDatabase()

    const user = await registerUser('session-test@example.com')
    token = user.token
    userId = user.userId

    const otherUser = await registerUser('other-session@example.com')
    otherUserId = otherUser.userId

    const subject = await Subject.create({ name: 'Algorithms', slug: 'algorithms', category: 'ds' })

    const session = await StudySession.create({
      userId,
      subjectId: subject._id,
      startedAt: new Date(),
      idempotencyKey: `session-${userId}-${Date.now()}`,
    })
    sessionId = session._id.toString()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('authenticated user can update their own session', async () => {
    const response = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ notes: 'Updated notes', sessionType: 'revision' })
    expect(response.status).toBe(200)
    expect(response.body.data.notes).toBe('Updated notes')
    expect(response.body.data.sessionType).toBe('revision')
    const updated = await StudySession.findById(sessionId)
    expect(updated?.notes).toBe('Updated notes')
    expect(updated?.sessionType).toBe('revision')
  })

  it('another user cannot modify the session', async () => {
    const hackerToken = (await registerUser('hacker-session@example.com')).token
    const response = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${hackerToken}`)
      .send({ notes: 'Should not persist' })
    expect([401, 403]).toContain(response.status)
    const unchanged = await StudySession.findById(sessionId)
    expect(unchanged?.notes).not.toBe('Should not persist')
  })

  it('invalid session ID returns 404', async () => {
    const response = await request(app).patch('/api/sessions/nonexistent-id').set('Authorization', `Bearer ${token}`).send({ notes: 'test' })
    expect(response.status).toBe(404)
  })

  it('empty payload returns validation error', async () => {
    const response = await request(app)
      .patch(`/api/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect([400, 422]).toContain(response.status)
  }
})
describe('PATCH /api/topics/:topicId/progress', () => {
  let token: string
  let userId: string
  let otherUserId: string
  let topicId: string

  beforeAll(async () => {
    await startTestDatabase()

    const user = await registerUser('progress-test@example.com')
    token = user.token
    userId = user.userId

    const otherUser = await registerUser('other-progress@example.com')
    otherUserId = otherUser.userId

    const subject = await Subject.create({ name: 'Math', slug: 'math', category: 'qs' })

    const topic = await Topic.create({
      name: 'Algebra',
      slug: 'algebra',
      subjectId: subject._id,
      ownerId: userId,
    })
    topicId = topic._id.toString()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('first update creates the progress record', async () => {
    const response = await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress', confidence: 85, estimatedStudyMinutes: 30 })
    expect(response.status).toBe(200)
    expect(response.body.data.status).toBe('in_progress')
    expect(response.body.data.confidence).toBe(85)
    expect(response.body.data.actualStudyMinutes).toBe(0)
    expect(response.body.data.revisionCount).toBe(0)
    const progress = await TopicProgress.findOne({ userId, topicId })
    expect(progress).toBeDefined()
    expect(progress?.status).toBe('in_progress')
  })

  it('subsequent updates modify the existing record', async () => {
    await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress', confidence: 70 })
    const response = await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confidence: 90, actualStudyMinutes: 45 })
    expect(response.status).toBe(200)
    expect(response.body.data.confidence).toBe(90)
    expect(response.body.data.actualStudyMinutes).toBe(45)
    const count = await TopicProgress.countDocuments({ userId, topicId })
    expect(count).toBe(1)
  })

  it('invalid status is rejected', async () => {
    const response = await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalid_status' })
    expect([400, 422]).toContain(response.status)
  })

  it('confidence out of range is rejected', async () => {
    const response = await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({ confidence: 150 })
    expect([400, 422]).toContain(response.status)
  })

  it('unauthorized user cannot update another user\'s topic', async () => {
    const hackerToken = (await registerUser('hacker-progress@example.com')).token
    const response = await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${hackerToken}`)
      .send({ status: 'completed' })
    expect([401, 403, 404]).toContain(response.status)
  })

  it('empty payload handles gracefully', async () => {
    const response = await request(app)
      .patch(`/api/topics/${topicId}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect([200, 400, 422]).toContain(response.status)
  })
})

describe('GET /api/analytics/dashboard', () => {
  let token: string
  let userId: string

  beforeAll(async () => {
    await startTestDatabase()

    const user = await registerUser('dashboard-test@example.com')
    token = user.token
    userId = user.userId
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('returns dashboard summary with expected structure', async () => {
    const response = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${token}`)
    expect(response.status).toBe(200)
    expect(response.body.data).toBeDefined()
    expect(response.body.data.tasksCompletedToday).toBeDefined()
    expect(response.body.data.minutesStudiedToday).toBeDefined()
    expect(response.body.data.questionsSolvedToday).toBeDefined()
    expect(response.body.data.accuracyToday).toBeDefined()
    expect(response.body.data.streakDays).toBeDefined()
    expect(Array.isArray(response.body.data.subjects)).toBe(true)
  })
})