import express, { type Application } from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { env, isProduction } from './config/env'
import { logger } from './config/logger'
import { errorHandler, notFoundHandler } from './middleware/error.middleware'
import { csrfProtection } from './middleware/csrf.middleware'
import { globalLimiter } from './middleware/rate-limit.middleware'
import { forbidden } from './utils/errors'
import authRoutes from './routes/auth.routes'
import curriculumRoutes from './routes/curriculum.routes'
import questionRoutes from './routes/question.routes'
import plannerRoutes from './routes/planner.routes'
import projectRoutes from './routes/project.routes'
import resumeRoutes from './routes/resume.routes'
import analyticsRoutes from './routes/analytics.routes'
import { isDatabaseConnected } from './config/database'

export function createApp(): Application {
  const app = express()

  // Behind a proxy/load balancer, trust the first hop so `req.ip` and
  // `secure` cookies behave correctly.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(
    helmet({
      // The API serves JSON only; a strict CSP would only interfere.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = env.CLIENT_ORIGIN.split(',')
          .map((o) => o.trim())
          .filter(Boolean)
        // Requests without an Origin header (server-to-server, curl) are allowed.
        if (!origin) return callback(null, true)
        if (allowed.includes(origin)) return callback(null, true)
        return callback(forbidden(`Origin ${origin} is not allowed by CORS`))
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 600,
    }),
  )

  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use(cookieParser())

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === '/api/health',
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
      },
    }),
  )

  app.use(globalLimiter)
  app.use('/api', csrfProtection)

  // Health check — no auth required, used by load balancers and uptime monitors.
  app.get('/api/health', (_req, res) => {
    const dbHealthy = isDatabaseConnected()
    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'prepforge-backend',
      uptime: Math.round(process.uptime()),
      database: dbHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api', curriculumRoutes)
  app.use('/api', questionRoutes)
  app.use('/api', plannerRoutes)
  app.use('/api', projectRoutes)
  app.use('/api', resumeRoutes)
  app.use('/api', analyticsRoutes)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export { isProduction }
