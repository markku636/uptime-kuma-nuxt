// SerwerSMS notification provider (Polish SMS service)

interface SerwerSMSConfig {
  serwersmsUsername: string
  serwersmsPassword: string
  serwersmsPhoneNumber: string
  serwersmsSenderName: string
}

export async function send(
  config: SerwerSMSConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://api2.serwersms.pl/messages/send_sms'
  const cleanMsg = message.replace(/[^\x00-\x7F]/g, '')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: config.serwersmsUsername,
      password: config.serwersmsPassword,
      phone: config.serwersmsPhoneNumber,
      text: cleanMsg,
      sender: config.serwersmsSenderName
    })
  })

  if (!response.ok) {
    throw new Error(`SerwerSMS notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(`SerwerSMS notification failed: ${result.error?.message || 'Unknown error'}`)
  }
}

export default { send }
