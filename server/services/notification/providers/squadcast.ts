// Squadcast notification provider
// Incident management platform

interface SquadcastConfig {
  squadcastWebhookURL: string
}

export async function send(
  config: SquadcastConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info',
  monitor?: { id: number; name: string }
): Promise<void> {
  const data: Record<string, any> = {
    message: title,
    description: message,
    tags: {},
    source: 'uptime-kuma',
    status: status === 'down' ? 'trigger' : 'resolve'
  }

  if (monitor) {
    data.event_id = monitor.id.toString()
    data.tags['Monitor'] = monitor.name
  }

  const response = await fetch(config.squadcastWebhookURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Squadcast notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
