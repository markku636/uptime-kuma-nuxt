// Whapi (WhatsApp Business API) notification provider

interface WhapiConfig {
  whapiApiUrl: string
  whapiAuthToken: string
  whapiRecipient: string
}

export async function send(
  config: WhapiConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = `${config.whapiApiUrl}/messages/text`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.whapiAuthToken}`,
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      typing_time: 0,
      to: config.whapiRecipient,
      body: message
    })
  })

  if (!response.ok) {
    throw new Error(`Whapi notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (!result.sent) {
    throw new Error(`Whapi notification failed: ${JSON.stringify(result)}`)
  }
}

export default { send }
