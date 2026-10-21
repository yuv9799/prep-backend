import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors'
import { logger } from '../config/logger'
import { isProduction } from '../config/env'

interface MongoLikeError extends Error {
  code?: number
  keyValue?: Record<string, unknown>
  errors?: Record<string, { message?: string }>
}

/** Converts a Mongo/Mongoose error into the standard error envelope. */
function normalise(error: unknown): AppError {
  if (error instanceof AppError) return error

  if (error instanceof ZodError) {
    return new AppError(422, 'VALIDATION_ERROR', 'Request validation failed')
  }

  const mongo = error as MongoLikeError
  if (mongo?.code === 11000) {
    const field = Object.keys(mongo.keyValue ?? {})[0] ?? 'field'
    return new AppError(409, 'CONFLICT', `A record with that ${field} already exists`)
  }

  if (mongo?.name === 'ValidationError' || mongo?.name === 'CastError') {
    return new AppError(400, 'BAD_REQUEST', 'Invalid value supplied')
  }

  return new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred')
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = normalise(error)

  const logPayload = {
    err: error,
    status: appError.status,
    code: appError.code,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
  }

  if (appError.status >= 500) {
    logger.error(logPayload, 'Unhandled request error')
  } else {
    logger.warn(logPayload, 'Request failed')
  }

  // Production responses must not leak internals.
  const message =
    appError.status >= 500 && isProduction ? 'An unexpected error occurred' : appError.message

  const body: {
    success: false
    error: {
      code: string
      message: string
      details?: Record<string, string[]>
    }
  } = { success: false, error: { code: appError.code, message } }

  if (appError.errors) body.error.details = appError.errors

  res.status(appError.status).json(body)
}

/** 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  })
}
