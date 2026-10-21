import request from 'supertest'
import { expect } from 'vitest'
import { createApp } from '../app'

export const app = createApp()

/**
 * Registers a fresh user and returns its bearer token. The bearer header also
 * exempts the request from the Origin-based CSRF check.
 */
export async function registerUser(
  email: string,
  password = 'Str0ngPassword!23',
): Promise<{ token: string; userId: string }> {
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email, password })

  expect(response.status).toBe(201)
  return {
    token: response.body.data.accessToken as string,
    userId: response.body.data.user.id as string,
  }
}