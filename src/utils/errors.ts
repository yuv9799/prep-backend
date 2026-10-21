/**
 * Application-level error with an HTTP status and stable machine-readable code.
 * The central error middleware renders these into the standard error envelope.
 */
export class AppError extends Error {
  status: number
  code: string
  errors?: Record<string, string[]>
  isOperational = true

  constructor(
    status: number,
    code: string,
    message: string,
    errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.errors = errors
    Error.captureStackTrace(this, AppError)
  }
}

export const badRequest = (message: string, errors?: Record<string, string[]>) =>
  new AppError(400, 'BAD_REQUEST', message, errors)

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message)

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message)

export const notFound = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message)

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message)

export const unprocessable = (message: string, errors?: Record<string, string[]>) =>
  new AppError(422, 'VALIDATION_ERROR', message, errors)

export const tooManyRequests = (message = 'Too many requests, please try again later') =>
  new AppError(429, 'RATE_LIMITED', message)
