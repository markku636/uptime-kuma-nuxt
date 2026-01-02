// SendGrid notification provider
// Email delivery service by Twilio

interface SendGridConfig {
  sendgridApiKey: string
  sendgridFromEmail: string
  sendgridToEmail: string
  sendgridCcEmail?: string
  sendgridBccEmail?: string
  sendgridSubject?: string
}

export async function send(
  config: SendGridConfig,
  title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const personalizations: Record<string, any> = {
    to: [{ email: config.sendgridToEmail }]
  }

  // Add CC recipients
  if (config.sendgridCcEmail) {
    personalizations.cc = config.sendgridCcEmail
      .split(',')
      .map(email => ({ email: email.trim() }))
  }

  // Add BCC recipients
  if (config.sendgridBccEmail) {
    personalizations.bcc = config.sendgridBccEmail
      .split(',')
      .map(email => ({ email: email.trim() }))
  }

  const data = {
    personalizations: [personalizations],
    from: { email: config.sendgridFromEmail.trim() },
    subject: config.sendgridSubject || title || 'Notification from Uptime Kuma',
    content: [{
      type: 'text/plain',
      value: message
    }]
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.sendgridApiKey}`
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SendGrid notification failed: ${response.status} - ${errorText}`)
  }
}

export default { send }
