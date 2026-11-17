// server/services/notification/providers/email.ts
// SMTP via nodemailer. Accepts both notification forms' field names
// (smtpFrom / smtpTo / CC / BCC, or fromEmail / toEmail).
import nodemailer from 'nodemailer'
import type { NotificationMessage } from '../sender'
import { escapeHtml, renderTemplate } from '../template'

export interface EmailConfig {
  smtpHost: string
  smtpPort: number | string
  /** Implicit TLS (usually port 465); otherwise STARTTLS when offered */
  smtpSecure?: boolean
  smtpIgnoreTLSError?: boolean
  smtpUsername?: string
  smtpPassword?: string
  smtpFrom?: string
  smtpTo?: string
  smtpCC?: string
  smtpBCC?: string
  fromEmail?: string
  toEmail?: string
  customSubject?: string
  customBody?: string
  /** customBody is HTML */
  htmlBody?: boolean
  smtpDkimDomain?: string
  smtpDkimKeySelector?: string
  smtpDkimPrivateKey?: string
  smtpDkimHashAlgo?: string
  smtpDkimheaderFieldNames?: string
  smtpDkimskipFields?: string
}

function defaultBody(message: NotificationMessage): string {
  return [
    `Monitor: ${message.monitorName}`,
    `Status: ${message.status.toUpperCase()}`,
    `Message: ${message.body}`,
    `Response Time: ${message.ping}ms`,
    `URL: ${message.monitorUrl || 'N/A'}`,
    `Time: ${message.time}`,
  ].join('\n')
}

/** The mail nodemailer sends, without transport details (unit tested) */
export function buildMail(config: EmailConfig, message: NotificationMessage) {
  const from = (config.smtpFrom || config.fromEmail || '').trim()
  const to = (config.smtpTo || config.toEmail || '').trim()
  const cc = config.smtpCC?.trim() || undefined
  const bcc = config.smtpBCC?.trim() || undefined
  if (!from) throw new Error('Email: a From address is required')
  if (!to && !cc && !bcc) throw new Error('Email: at least one recipient (To, CC or BCC) is required')

  const subject = config.customSubject?.trim()
    ? renderTemplate(config.customSubject, message).replace(/[\r\n]+/g, ' ')
    : message.title
  const custom = config.customBody?.trim()
  const mail: Record<string, unknown> = { from, to: to || undefined, cc, bcc, subject }
  if (custom && config.htmlBody) mail.html = renderTemplate(custom, message, escapeHtml)
  else mail.text = custom ? renderTemplate(custom, message) : defaultBody(message)
  return mail
}

export const emailProvider = {
  async send(config: EmailConfig, message: NotificationMessage) {
    if (!config.smtpHost) throw new Error('Email: SMTP host is required')
    const mail = buildMail(config, message)
    const port = Number(config.smtpPort) || (config.smtpSecure ? 465 : 587)

    const dkim = config.smtpDkimDomain && config.smtpDkimKeySelector && config.smtpDkimPrivateKey
      ? {
          domainName: config.smtpDkimDomain,
          keySelector: config.smtpDkimKeySelector,
          privateKey: config.smtpDkimPrivateKey,
          hashAlgo: config.smtpDkimHashAlgo || undefined,
          headerFieldNames: config.smtpDkimheaderFieldNames || undefined,
          skipFields: config.smtpDkimskipFields || undefined,
        }
      : undefined

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port,
      secure: !!config.smtpSecure,
      auth: config.smtpUsername ? { user: config.smtpUsername, pass: config.smtpPassword || '' } : undefined,
      tls: config.smtpIgnoreTLSError ? { rejectUnauthorized: false } : undefined,
      dkim,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    } as any)
    try {
      await transporter.sendMail(mail as any)
    } finally {
      transporter.close()
    }
  },
}
