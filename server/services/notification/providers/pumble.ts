// Pumble notification provider
// Team messaging app

interface PumbleConfig {
  pumbleWebhookURL: string
}

export async function send(
  config: PumbleConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const color = status === 'down' ? '#DC3645' : '#5BDD8B'

  const data = {
    attachments: [{
      title: status === 'info' ? 'Uptime Kuma Alert' : `${title} is ${status}`,
      text: message,
      color
    }]
  }

  const response = await fetch(config.pumbleWebhookURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Pumble notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
