// Seven.io SMS notification provider

interface SevenIOConfig {
  sevenioApiKey: string
  sevenioTo: string
  sevenioSender?: string
}

export async function send(
  config: SevenIOConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  let text = message
  
  if (status === 'down') {
    text = `Your service ${title} went down. Error: ${message}`
  } else if (status === 'up') {
    text = `Your service ${title} went back up. ${message}`
  }

  const response = await fetch('https://gateway.seven.io/api/sms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.sevenioApiKey
    },
    body: JSON.stringify({
      to: config.sevenioTo,
      from: config.sevenioSender || 'Uptime Kuma',
      text
    })
  })

  if (!response.ok) {
    throw new Error(`Seven.io notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
