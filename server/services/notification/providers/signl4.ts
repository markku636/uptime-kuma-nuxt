// SIGNL4 notification provider
// Mobile alerting and incident response

interface SIGNL4Config {
  signl4WebhookURL: string
}

export async function send(
  config: SIGNL4Config,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info',
  monitor?: { id: number; name: string; url?: string }
): Promise<void> {
  const data: Record<string, any> = {
    title,
    message,
    'X-S4-SourceSystem': 'UptimeKuma'
  }

  if (monitor) {
    data['X-S4-ExternalID'] = `UptimeKuma-${monitor.id}`
    data.monitorUrl = monitor.url || ''
    
    if (status === 'up') {
      data['X-S4-Status'] = 'resolved'
    } else if (status === 'down') {
      data['X-S4-Status'] = 'new'
    }
  }

  const response = await fetch(config.signl4WebhookURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`SIGNL4 notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
