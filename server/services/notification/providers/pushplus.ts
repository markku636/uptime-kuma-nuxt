// PushPlus notification provider
// Chinese WeChat push notification service (PushPlus 推送加)

interface PushPlusConfig {
  pushPlusSendKey: string
  pushPlusChannel?: 'wechat' | 'webhook' | 'cp' | 'mail'
}

export async function send(
  config: PushPlusConfig,
  title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const data: Record<string, string> = {
    token: config.pushPlusSendKey,
    title,
    content: message,
    template: 'html'
  }

  if (config.pushPlusChannel) {
    data.channel = config.pushPlusChannel
  }

  const response = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`PushPlus notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 200) {
    throw new Error(`PushPlus notification failed: ${result.msg}`)
  }
}

export default { send }
