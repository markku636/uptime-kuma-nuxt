// WPush notification provider
// Chinese WeChat push notification service

interface WPushConfig {
  wpushAPIkey: string
  wpushChannel?: string
}

export async function send(
  config: WPushConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const statusText = status === 'up' ? 'Up' : status === 'down' ? 'Down' : 'Message'
  
  const data: Record<string, string> = {
    title: status === 'info' ? 'UptimeKuma Message' : `UptimeKuma Monitor ${statusText} ${title}`,
    content: message,
    apikey: config.wpushAPIkey
  }

  if (config.wpushChannel) {
    data.channel = config.wpushChannel
  }

  const response = await fetch('https://api.wpush.cn/api/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`WPush notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(`WPush notification failed: ${result.message}`)
  }
}

export default { send }
