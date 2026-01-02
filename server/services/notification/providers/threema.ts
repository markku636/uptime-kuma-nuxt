// Threema notification provider
// Secure messaging app

interface ThreemaConfig {
  threemaSenderIdentity: string
  threemaSecret: string
  threemaRecipientType: 'identity' | 'phone' | 'email'
  threemaRecipient: string
}

export async function send(
  config: ThreemaConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://msgapi.threema.ch/send_simple'

  const data: Record<string, string> = {
    from: config.threemaSenderIdentity,
    secret: config.threemaSecret,
    text: message
  }

  // Set recipient based on type
  switch (config.threemaRecipientType) {
    case 'identity':
      data.to = config.threemaRecipient
      break
    case 'phone':
      data.phone = config.threemaRecipient
      break
    case 'email':
      data.email = config.threemaRecipient
      break
    default:
      throw new Error(`Unsupported Threema recipient type: ${config.threemaRecipientType}`)
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    },
    body: new URLSearchParams(data)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Threema notification failed: ${response.status} - ${errorText}`)
  }
}

export default { send }
