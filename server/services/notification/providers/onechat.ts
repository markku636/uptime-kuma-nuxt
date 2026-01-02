// OneChat notification provider (Thai chat platform)

interface OneChatConfig {
  onechatAccessToken: string
  onechatBotId: string
  onechatReceiverId: string
}

export async function send(
  config: OneChatConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://chat-api.one.th/message/api/v1/push_message'
  const statusEmoji = status === 'down' ? '🔴 Down' : status === 'up' ? '🟢 Up' : 'ℹ️'
  
  const fullMessage = `UptimeKuma Alert:\n[${statusEmoji}]\nName: ${title}\n${message}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.onechatAccessToken}`
    },
    body: JSON.stringify({
      to: config.onechatReceiverId,
      bot_id: config.onechatBotId,
      type: 'text',
      message: fullMessage
    })
  })

  if (!response.ok) {
    throw new Error(`OneChat notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
