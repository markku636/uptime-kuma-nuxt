// server/services/notification/providers/email.ts
import type { NotificationMessage } from '../sender'

export const emailProvider = {
  async send(config: {
    smtpHost: string
    smtpPort: number
    smtpSecure: boolean
    smtpUsername?: string
    smtpPassword?: string
    fromEmail: string
    toEmail: string
  }, message: NotificationMessage) {
    // Note: This is a placeholder implementation
    // In production, you would use nodemailer or similar
    
    console.log(`[Email] Would send email to ${config.toEmail}:`, {
      from: config.fromEmail,
      to: config.toEmail,
      subject: message.title,
      body: `
Monitor: ${message.monitorName}
Status: ${message.status.toUpperCase()}
Message: ${message.body}
Response Time: ${message.ping}ms
URL: ${message.monitorUrl || 'N/A'}
Time: ${message.time}
      `
    })

    // To implement properly, install nodemailer:
    // import nodemailer from 'nodemailer'
    // const transporter = nodemailer.createTransport({
    //   host: config.smtpHost,
    //   port: config.smtpPort,
    //   secure: config.smtpSecure,
    //   auth: config.smtpUsername ? {
    //     user: config.smtpUsername,
    //     pass: config.smtpPassword
    //   } : undefined
    // })
    // await transporter.sendMail({ ... })
  }
}
