// Onesender WhatsApp notification provider

interface OnesenderConfig {
  onesenderURL: string
  onesenderToken: string
  onesenderReceiver: string
  onesenderTypeReceiver: 'private' | 'group'
}

export async function send(
  config: OnesenderConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const to = config.onesenderTypeReceiver === 'private' 
    ? `${config.onesenderReceiver}@s.whatsapp.net`
    : `${config.onesenderReceiver}@g.us`

  const data = {
    to,
    type: 'text',
    recipient_type: config.onesenderTypeReceiver === 'private' ? 'individual' : 'group',
    text: { body: message }
  }

  const response = await fetch(config.onesenderURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.onesenderToken}`
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Onesender notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
