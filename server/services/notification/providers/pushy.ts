// Pushy notification provider
// Cross-platform push notification service

interface PushyConfig {
  pushyAPIKey: string
  pushyToken: string // Device or topic token
}

export async function send(
  config: PushyConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const data = {
    to: config.pushyToken,
    data: {
      message: 'Uptime-Kuma'
    },
    notification: {
      body: message,
      badge: 1,
      sound: 'ping.aiff'
    }
  }

  const response = await fetch(
    `https://api.pushy.me/push?api_key=${config.pushyAPIKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  )

  if (!response.ok) {
    throw new Error(`Pushy notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
