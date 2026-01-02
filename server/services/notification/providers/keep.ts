// Keep notification provider
// Keep AIOps Platform integration

interface KeepConfig {
  keepWebhookURL: string
  keepWebhookAPIKey: string
}

export async function send(
  config: KeepConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info',
  monitor?: { id: number; name: string },
  heartbeat?: { status: number; msg: string }
): Promise<void> {
  let url = config.keepWebhookURL
  
  if (url.endsWith('/')) {
    url = url.slice(0, -1)
  }

  const webhookURL = url + '/alerts/event/uptimekuma'

  const data = {
    heartbeat,
    monitor,
    msg: message
  }

  const response = await fetch(webhookURL, {
    method: 'POST',
    headers: {
      'x-api-key': config.keepWebhookAPIKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Keep notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
