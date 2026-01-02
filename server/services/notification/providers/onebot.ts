// OneBot notification provider
// QQ bot protocol implementation

interface OneBotConfig {
  httpAddr: string
  accessToken?: string
  msgType: 'private' | 'group'
  recieverId: string
}

export async function send(
  config: OneBotConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  let url = config.httpAddr
  
  if (!url.startsWith('http')) {
    url = 'http://' + url
  }
  if (!url.endsWith('/')) {
    url += '/'
  }
  url += 'send_msg'

  const pushText = 'UptimeKuma Alert: ' + message

  const data: Record<string, any> = {
    auto_escape: true,
    message: pushText
  }

  if (config.msgType === 'group') {
    data.message_type = 'group'
    data.group_id = config.recieverId
  } else {
    data.message_type = 'private'
    data.user_id = config.recieverId
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`OneBot notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
