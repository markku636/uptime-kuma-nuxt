// 狀態頁訂閱信件：只走操作者設定的 SMTP relay，收件者與內容都嚴格驗證。
import nodemailer from 'nodemailer'

const EMAIL = /^[^\s@,:;<>"]+@[^\s@,:;<>".]+(?:\.[^\s@,:;<>"."]+)+$/
const HOST = /^[A-Za-z0-9.-]{1,253}$/

export function validSubscriberEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  if (email.length > 320 || !EMAIL.test(email)) return null
  return email
}

export function smtpConfigured(): boolean {
  const host = process.env.SMTP_HOST || ''
  const port = Number(process.env.SMTP_PORT || 587)
  return HOST.test(host) && Number.isInteger(port) && port >= 1 && port <= 65535 && !!process.env.SMTP_FROM
}

export async function sendSubscriberMail(to: string, subject: string, text: string): Promise<void> {
  const email = validSubscriberEmail(to)
  if (!email || !smtpConfigured()) throw new Error('UNSUPPORTED_PROVIDER')
  const port = Number(process.env.SMTP_PORT || 587)
  const auth = process.env.SMTP_USER && process.env.SMTP_PASS
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST!, port, secure: port === 465, auth,
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
  })
  await transport.sendMail({
    from: process.env.SMTP_FROM!, to: email,
    subject: subject.slice(0, 200), text: text.slice(0, 20_000),
  })
}

export function confirmationText(slug: string, token: string): { subject: string; text: string } {
  const base = process.env.NUXT_PUBLIC_APP_URL || ''
  const link = `${base}/api/status/${encodeURIComponent(slug)}/subscribers/verify?token=${encodeURIComponent(token)}`
  return {
    subject: 'Confirm your status page subscription',
    text: `You subscribed to ${slug} status updates.\n\nConfirm: ${link}\n\nUnsubscribe: ${base}/api/status/${encodeURIComponent(slug)}/subscribers/unsubscribe?token=${encodeURIComponent(token)}`,
  }
}
