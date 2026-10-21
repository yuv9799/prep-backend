import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { type ZodError, type ZodTypeAny } from 'zod'
import { unprocessable } from '../utils/errors'

/**
 * Wraps an async handler so rejected promises reach Express' error pipeline
 * instead of becoming unhandled rejections.
 */
export function asyncHandler(fn: (...args: any[]) => Promise<unknown>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/** Converts a Zod error into the standard `errors` map shape used by the UI. */
export function formatZodError(error: ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_root'
    if (!result[key]) result[key] = []
    result[key].push(issue.message)
  }
  return result
}

/**
 * Validates `req.body`, `req.query` and `req.params` against the supplied
 * schemas and replaces them with the parsed (coerced, stripped) values.
 * Unknown keys are stripped by Zod, which prevents mass assignment.
 */
export function validate(schema: {
  body?: ZodTypeAny
  query?: ZodTypeAny
  params?: ZodTypeAny
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schema.body) {
        const result = schema.body.safeParse(req.body)
        if (!result.success) throw unprocessable('Request validation failed', formatZodError(result.error))
        req.body = result.data
      }
      if (schema.query) {
        const result = schema.query.safeParse(req.query)
        if (!result.success) throw unprocessable('Query validation failed', formatZodError(result.error))
        Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true })
      }
      if (schema.params) {
        const result = schema.params.safeParse(req.params)
        if (!result.success) throw unprocessable('Path parameter validation failed', formatZodError(result.error))
        req.params = result.data as Request['params']
      }
      next()
    } catch (error) {
      next(error)
    }
  }
}
