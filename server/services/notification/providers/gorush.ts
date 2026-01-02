// Gorush notification provider - Go push notification server

interface GorushConfig {
  gorushServerURL: string
  gorushDeviceToken: string
  gorushPlatform: 'ios' | 'android' | 'huawei'
  gorushTitle?: string
  gorushPriority?: string
  gorushRetry?: number
  gorushTopic?: string
}

export async function send(
  config: GorushConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const platformMapping: Record<string, number> = {
    ios: 1,
    android: 2,
    huawei: 3
  }

  const data = {
    notifications: [{
      tokens: [config.gorushDeviceToken],
      platform: platformMapping[config.gorushPlatform],
      message,
      title: config.gorushTitle || 'Uptime Kuma',
      priority: config.gorushPriority,
      retry: config.gorushRetry || 0,
      topic: config.gorushTopic
    }]
  }

  const response = await fetch(`${config.gorushServerURL}/api/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`Gorush notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
