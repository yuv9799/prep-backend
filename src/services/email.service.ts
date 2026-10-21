import nodemailer, { type Transporter } from 'nodemailer'
import { env, isProduction } from '../config/env'
import { logger } from '../config/logger'

let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!isProduction) return null
  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    logger.warn('SMTP is not configured; emails will not be sent')
    return null
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  }
  return transporter
}

export interface EmailPayload {
  to: string
  subject: string
  text: string
  html?: string
}

/**
 * Sends an email. In development/test the message is logged instead of being
 * delivered, so the reset flow stays testable without an SMTP server.
 * A failure to send must never fail the request that triggered it.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (env.EMAIL_LOG_ONLY) {
    logger.info(
      { to: payload.to, subject: payload.subject, body: payload.text },
      'Email (log-only mode)',
    )
    return true
  }

  const mailer = getTransporter()
  if (!mailer) {
    logger.warn({ to: payload.to }, 'Email skipped: no SMTP transport configured')
    return false
  }

  try {
    await mailer.sendMail({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    })
    logger.info({ to: payload.to, subject: payload.subject }, 'Email sent')
    return true
  } catch (error) {
    logger.error({ err: error, to: payload.to }, 'Failed to send email')
    return false
  }
}
