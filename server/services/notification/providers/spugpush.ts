// SpugPush notification provider
// Chinese push notification service (Spug 推送)

interface SpugPushConfig {
  spugpushTemplateKey: string
}

export async function send(
  config: SpugPushConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const statusEmoji = status === 'down' ? '🔴 Down' : status === 'up' ? '✅ Up' : 'ℹ️ Info'
  
  const formData = {
    title: status === 'info' ? 'Uptime Kuma Message' : `UptimeKuma 「${title}」 is ${status === 'up' ? 'Up' : 'Down'}`,
    content: `[${statusEmoji}] ${message}`
  }

  const url = `https://push.spug.cc/send/${config.spugpushTemplateKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(formData)
  })

  if (!response.ok) {
    throw new Error(`SpugPush notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
