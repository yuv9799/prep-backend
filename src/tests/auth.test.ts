import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app, registerUser } from './test-helpers'
import { startTestDatabase, stopTestDatabase } from './test-db'

describe('auth: registration and session lifecycle', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('registers a user, returning the user and a token pair', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'Str0ngPassword!23',
    })

    expect(response.status).toBe(201)
    expect(response.body.data.user.email).toBe('ada@example.com')
    expect(response.body.data.user.name).toBe('Ada Lovelace')
    expect(response.body.data.accessToken).toBeTypeOf('string')
    expect(response.body.data.refreshToken).toBeTypeOf('string')
  })

  it('rejects a duplicate email with 409', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Ada Again',
      email: 'ada@example.com',
      password: 'Str0ngPassword!23',
    })

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('CONFLICT')
  })

  it('rejects a weak password with 422', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Weak Password',
      email: 'weak@example.com',
      password: 'short',
    })

    expect(response.status).toBe(422)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    expect(response.body.errors.password).toBeDefined()
  })

  it('signs in with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'Str0ngPassword!23' })

    expect(response.status).toBe(200)
    expect(response.body.data.user.email).toBe('ada@example.com')
  })

  it('rejects a wrong password with 401, not 422', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ada@example.com', password: 'WrongPassword!23' })

    expect(response.status).toBe(401)
  })

  it('returns the current user for a valid bearer token', async () => {
    const { token } = await registerUser('me@example.com')
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data.email).toBe('me@example.com')
  })

  it('rejects an invalid bearer token with 401', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')

    expect(response.status).toBe(401)
  })

  it('updates the profile and the study preferences', async () => {
    const { token } = await registerUser('profile@example.com')

    const profile = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed User', targetRole: 'SDE' })

    expect(profile.status).toBe(200)
    expect(profile.body.data.name).toBe('Renamed User')

    const preferences = await request(app)
      .patch('/api/auth/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ dailyGoalMinutes: 90, weekStartsOn: 0 })

    expect(preferences.status).toBe(200)
    expect(preferences.body.data.dailyGoalMinutes).toBe(90)
    expect(preferences.body.data.weekStartsOn).toBe(0)
  })

  it('rejects an unknown key in the profile payload', async () => {
    const { token } = await registerUser('strict@example.com')

    const response = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' })

    expect(response.status).toBe(422)
  })
})