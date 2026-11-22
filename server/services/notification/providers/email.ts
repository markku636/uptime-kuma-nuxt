import nodemailer from 'nodemailer'

interface EmailConfig { to?: unknown }

function recipients(value: unknown) {
  if (typeof value !== 'string') throw new Error('UNSUPPORTED_PROVIDER')
  const list = value.split(',').map(item => item.trim()).filter(Boolean)
  if (!list.length || list.length > 10 || list.some(item =>
    item.length > 200 || !/^[^\s@,:;<>"]+@[^\s@,:;<>".]+(?:\.[^\s@,:;<>"."]+)+$/.test(item))) {
    throw new Error('UNSUPPORTED_PROVIDER')
  }
  return list.join(', ')
}

/**
 * Email delivery is only available through an operator-configured SMTP relay.
 * The destination list comes from the notification resource; host/credentials
 * are never accepted from user input, which keeps this transport SSRF-safe.
 */
export const emailProvider = {
  async send(config: EmailConfig, message: { title: string; body: string }) {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 587)
    const from = process.env.SMTP_FROM
    if (!host || !/^[A-Za-z0-9.-]{1,253}$/.test(host) || !Number.isInteger(port) || port < 1 || port > 65535 || !from) {
      throw new Error('UNSUPPORTED_PROVIDER')
    }
    const to = recipients(config?.to)
    const auth = process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
    await transport.sendMail({
      from,
      to,
      subject: message.title.slice(0, 200),
      text: `${message.title}\n\n${message.body}`.slice(0, 20_000),
    })
  },
}
