// Notifery notification provider

interface NotiferyConfig {
  notiferyApiKey: string
  notiferyTitle?: string
  notiferyGroup?: string
}

export async function send(
  config: NotiferyConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://api.notifery.com/event'
  
  const data: Record<string, any> = {
    title: config.notiferyTitle || title || 'Uptime Kuma Alert',
    message,
    code: status === 'up' ? 0 : 1
  }

  if (config.notiferyGroup) {
    data.group = config.notiferyGroup
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.notiferyApiKey
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Notifery notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
