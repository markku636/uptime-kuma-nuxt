// LINE Notify notification provider (legacy LINE notification service)

interface LineNotifyConfig {
  lineNotifyAccessToken: string
}

export async function send(
  config: LineNotifyConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://notify-api.line.me/api/notify'
  
  const statusEmoji = status === 'down' ? '🔴 Down' : status === 'up' ? '✅ Up' : 'ℹ️'
  const fullMessage = `\n[${statusEmoji}]\nName: ${title}\n${message}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Bearer ${config.lineNotifyAccessToken}`
    },
    body: new URLSearchParams({ message: fullMessage })
  })

  if (!response.ok) {
    throw new Error(`LINE Notify notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
