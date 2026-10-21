import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, registerUser } from './test-helpers'
import { startTestDatabase, stopTestDatabase } from './test-db'

describe('resume collections', () => {
  let token: string

  beforeAll(async () => {
    await startTestDatabase()
    const owner = await registerUser('resume@example.com')
    token = owner.token
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('returns a default draft for a new user', async () => {
    const response = await request(app)
      .get('/api/resume')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toBeDefined()
  })

  it('adds an education entry to the collection', async () => {
    const response = await request(app)
      .post('/api/resume/education')
      .set('Authorization', `Bearer ${token}`)
      .send({ institution: 'MIT', degree: 'B.S.', startYear: 2020, endYear: 2024 })

    expect(response.status).toBe(201)
    expect(response.body.data.institution).toBe('MIT')
  })

  it('lists the education entries it stored', async () => {
    const response = await request(app)
      .get('/api/resume/education')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
  })

  it('applies a partial patch to a collection item', async () => {
    const list = await request(app)
      .get('/api/resume/education')
      .set('Authorization', `Bearer ${token}`)
    const itemId = list.body.data[0].id as string

    const response = await request(app)
      .patch(`/api/resume/education/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ grade: '9.5 CGPA' })

    expect(response.status).toBe(200)
    expect(response.body.data.grade).toBe('9.5 CGPA')
    // Fields that were not patched are preserved.
    expect(response.body.data.institution).toBe('MIT')
  })

  it('rejects a patch that does not match the collection schema', async () => {
    const list = await request(app)
      .get('/api/resume/education')
      .set('Authorization', `Bearer ${token}`)
    const itemId = list.body.data[0].id as string

    const response = await request(app)
      .patch(`/api/resume/education/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ institution: 123 })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects an unknown collection', async () => {
    const response = await request(app)
      .get('/api/resume/unknown')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(422)
  })

  it('deletes a collection item', async () => {
    const list = await request(app)
      .get('/api/resume/education')
      .set('Authorization', `Bearer ${token}`)
    const itemId = list.body.data[0].id as string

    const response = await request(app)
      .delete(`/api/resume/education/${itemId}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)

    const after = await request(app)
      .get('/api/resume/education')
      .set('Authorization', `Bearer ${token}`)
    expect(after.body.data).toHaveLength(0)
  })
})

describe('cross-origin protection', () => {
  let token: string

  beforeAll(async () => {
    await startTestDatabase()
    const owner = await registerUser('csrf@example.com')
    token = owner.token
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('blocks a cookie-authenticated write from an untrusted origin', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Origin', 'https://evil.example.com')
      .send({ title: 'Should be blocked' })

    expect(response.status).toBe(403)
    expect(response.body.code).toBe('FORBIDDEN')
  })

  it('allows a write from the configured client origin', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Origin', 'http://localhost:5173')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Allowed project' })

    expect(response.status).toBe(201)
  })
})