// WAHA (WhatsApp HTTP API) notification provider

interface WAHAConfig {
  wahaApiUrl: string
  wahaSession?: string
  wahaChatId: string
}

export async function send(
  config: WAHAConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const session = config.wahaSession || 'default'
  const url = `${config.wahaApiUrl}/api/sendText`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session,
      chatId: config.wahaChatId,
      text: message
    })
  })

  if (!response.ok) {
    throw new Error(`WAHA notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
