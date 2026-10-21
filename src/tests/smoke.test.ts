import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from './test-helpers'
import { startTestDatabase, stopTestDatabase } from './test-db'

describe('smoke: infrastructure', () => {
  beforeAll(async () => {
    await startTestDatabase()
  })

  afterAll(async () => {
    await stopTestDatabase()
  })

  it('reports health', async () => {
    const response = await request(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('rejects an unauthenticated request to a protected route', async () => {
    const response = await request(app).get('/api/auth/me')
    expect(response.status).toBe(401)
  })

  it('returns 404 for an unknown route', async () => {
    const response = await request(app).get('/api/definitely-not-a-route')
    expect(response.status).toBe(404)
    expect(response.body.code).toBe('NOT_FOUND')
  })
})
