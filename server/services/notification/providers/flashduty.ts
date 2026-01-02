// FlashDuty notification provider
// Incident management platform (闪值)

interface FlashDutyConfig {
  flashdutyIntegrationKey: string
  flashdutySeverity?: 'Info' | 'Warning' | 'Critical'
}

export async function send(
  config: FlashDutyConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info',
  monitor?: { id: number; name: string; url?: string; type?: string }
): Promise<void> {
  const url = 'https://api.flashcat.cloud/event/push/alert/standard'

  const data: Record<string, any> = {
    integration_key: config.flashdutyIntegrationKey,
    title,
    description: message,
    event_status: status === 'down' ? 'Critical' : 'Ok',
    alert_key: monitor ? `uptime-kuma-${monitor.id}` : 'uptime-kuma-test',
    labels: {
      source: 'uptime-kuma'
    }
  }

  if (monitor) {
    data.labels.monitor_name = monitor.name
    data.labels.monitor_type = monitor.type || 'unknown'
    if (monitor.url) {
      data.labels.monitor_url = monitor.url
    }
  }

  if (status === 'down' && config.flashdutySeverity) {
    data.event_status = config.flashdutySeverity
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`FlashDuty notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
