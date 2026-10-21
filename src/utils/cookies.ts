import type { CookieOptions, Response } from 'express'
import { env, isProduction } from '../config/env'

export const ACCESS_COOKIE_NAME = 'pf_access'
export const REFRESH_COOKIE_NAME = 'pf_refresh'
export const CSRF_COOKIE_NAME = 'pf_csrf'

/**
 * Base cookie options. `sameSite: 'strict'` means the browser will not attach
 * these cookies to cross-site requests, which is the primary CSRF defence;
 * the Origin check in `csrf.middleware` is the second layer.
 */
function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  }
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(ACCESS_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: 15 * 60 * 1000,
  })
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
}

/** The CSRF cookie is intentionally readable by JS so the client can echo it. */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  })
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE_NAME, { ...baseOptions() })
  res.clearCookie(REFRESH_COOKIE_NAME, { ...baseOptions() })
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  })
}

export const cookieNames = {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME,
  csrf: CSRF_COOKIE_NAME,
}
