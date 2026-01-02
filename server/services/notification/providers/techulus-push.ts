// Techulus Push notification provider
// Push by Techulus - Simple push notifications

interface TechulusPushConfig {
  pushAPIKey: string
  pushTitle?: string
  pushChannel?: string
  pushSound?: string
  pushTimeSensitive?: boolean
}

export async function send(
  config: TechulusPushConfig,
  title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const data: Record<string, any> = {
    title: config.pushTitle || title || 'Uptime-Kuma',
    body: message,
    timeSensitive: config.pushTimeSensitive ?? true
  }

  if (config.pushChannel) {
    data.channel = config.pushChannel
  }

  if (config.pushSound) {
    data.sound = config.pushSound
  }

  const response = await fetch(
    `https://push.techulus.com/api/v1/notify/${config.pushAPIKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  )

  if (!response.ok) {
    throw new Error(`Techulus Push notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
