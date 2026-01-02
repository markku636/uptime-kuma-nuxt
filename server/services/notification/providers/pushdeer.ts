// PushDeer notification provider
// Self-hosted push notification service

interface PushDeerConfig {
  pushdeerServer?: string
  pushdeerKey: string
}

export async function send(
  config: PushDeerConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const serverUrl = config.pushdeerServer || 'https://api2.pushdeer.com'
  const cleanUrl = serverUrl.trim().replace(/\/+$/, '')
  const url = `${cleanUrl}/message/push`

  const statusEmoji = status === 'down' ? '⬇️' : status === 'up' ? '⬆️' : 'ℹ️'
  
  const data = {
    pushkey: config.pushdeerKey,
    text: `## ${statusEmoji} Uptime Kuma: ${title}`,
    desp: message.replace(/\n/g, '\n\n'),
    type: 'markdown'
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`PushDeer notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.error) {
    throw new Error(`PushDeer notification failed: ${result.error}`)
  }
}

export default { send }
