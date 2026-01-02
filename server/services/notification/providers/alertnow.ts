// AlertNow notification provider

interface AlertNowConfig {
  alertNowWebhookURL: string
}

export async function send(
  config: AlertNowConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const eventId = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '_' + title.replace(/\s/g, '')
  
  const data = {
    summary: `[${title}] ${status === 'up' ? '✅ Back online' : status === 'down' ? '🔴 Went down' : ''} - ${message}`,
    status: status === 'up' ? 'close' : 'open',
    event_type: status === 'up' ? 'INFO' : 'ERROR',
    event_id: eventId
  }

  const response = await fetch(config.alertNowWebhookURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`AlertNow notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
