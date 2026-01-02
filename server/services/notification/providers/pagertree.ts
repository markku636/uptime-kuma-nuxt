// PagerTree notification provider
// Incident management and on-call scheduling

interface PagerTreeConfig {
  pagerTreeIntegrationUrl: string
  pagerTreeUrgency?: 'low' | 'medium' | 'high' | 'critical'
  pagerTreeAutoResolve?: boolean
}

export async function send(
  config: PagerTreeConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info',
  monitor?: { id: number; name: string; url?: string }
): Promise<void> {
  const data: Record<string, any> = {
    title,
    description: message,
    urgency: config.pagerTreeUrgency || 'high'
  }

  if (monitor) {
    data.destination = monitor.url || ''
    data.source = 'uptime-kuma'
    data.dedup_key = `uptime-kuma-${monitor.id}`
  }

  // Set event type based on status
  if (status === 'down') {
    data.event_type = 'create'
  } else if (status === 'up' && config.pagerTreeAutoResolve) {
    data.event_type = 'resolve'
  } else if (status === 'info') {
    data.event_type = 'create'
  }

  const response = await fetch(config.pagerTreeIntegrationUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`PagerTree notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
