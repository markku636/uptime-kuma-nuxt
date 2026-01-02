// Kook notification provider
// Chinese gaming community platform (formerly KaiHeiLa)

interface KookConfig {
  kookBotToken: string
  kookGuildID: string // Channel ID
}

export async function send(
  config: KookConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://www.kookapp.cn/api/v3/message/create'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${config.kookBotToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      target_id: config.kookGuildID,
      content: message
    })
  })

  if (!response.ok) {
    throw new Error(`Kook notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 0) {
    throw new Error(`Kook notification failed: ${result.message}`)
  }
}

export default { send }
