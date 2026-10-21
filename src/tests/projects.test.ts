import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, registerUser } from './test-helpers'
import { startTestDatabase, stopTestDatabase } from './test-db'

describe('projects and achievements', () => {
  let token: string
  let otherToken: string

  beforeAll(async () => {
    await startTestDatabase()
    const owner = await registerUser('owner@example.com')
    const other = await registerUser('other@example.com')
    token = owner.token
    otherToken = other.token
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('creates a project and returns it in the listing', async () => {
    const created = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'PrepForge',
        description: 'A placement prep tool',
        technologies: ['React', 'Node'],
      })

    expect(created.status).toBe(201)
    expect(created.body.data.title).toBe('PrepForge')
    expect(created.body.data.status).toBe('planned')

    const list = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`)

    expect(list.status).toBe(200)
    expect(list.body.data.items).toHaveLength(1)
    expect(list.body.data.total).toBe(1)
  })

  it('does not leak another user’s projects', async () => {
    const list = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${otherToken}`)

    expect(list.status).toBe(200)
    expect(list.body.data.items).toHaveLength(0)
  })

  it('rejects a project with an invalid status', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad', status: 'not-a-status' })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects a project title that is too short', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x' })

    expect(response.status).toBe(422)
    expect(response.body.errors.title).toBeDefined()
  })

  it('creates an achievement as pending and only verifies it on approval', async () => {
    const created = await request(app)
      .post('/api/achievements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Won a hackathon', points: 100, sourceType: 'auto_suggested' })

    expect(created.status).toBe(201)
    expect(created.body.data.verificationStatus).toBe('pending')
    expect(created.body.data.sourceType).toBe('auto_suggested')

    const id = created.body.data.id as string

    const approved = await request(app)
      .post(`/api/achievements/${id}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ verificationStatus: 'verified' })

    expect(approved.status).toBe(200)
    expect(approved.body.data.verificationStatus).toBe('verified')
    // Approving an auto-suggested achievement promotes it to `verified`.
    expect(approved.body.data.sourceType).toBe('verified')
    expect(approved.body.data.approvedAt).toBeTruthy()
  })

  it('refuses to approve an achievement owned by someone else', async () => {
    const created = await request(app)
      .post('/api/achievements')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Owned elsewhere' })

    const id = created.body.data.id as string

    const response = await request(app)
      .post(`/api/achievements/${id}/approve`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ verificationStatus: 'verified' })

    expect(response.status).toBe(404)
  })

  it('requires authentication', async () => {
    const response = await request(app).get('/api/projects')
    expect(response.status).toBe(401)
  })
})