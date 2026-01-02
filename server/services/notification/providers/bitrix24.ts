// Bitrix24 notification provider

interface Bitrix24Config {
  bitrix24WebhookURL: string
  bitrix24UserID: string
}

export async function send(
  config: Bitrix24Config,
  _title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const color = status === 'up' ? '#67b518' : '#b73419'
  
  const params = new URLSearchParams({
    user_id: config.bitrix24UserID,
    message: '[B]Uptime Kuma[/B]',
    'ATTACH[COLOR]': color,
    'ATTACH[BLOCKS][0][MESSAGE]': message
  })

  const response = await fetch(
    `${config.bitrix24WebhookURL}/im.notify.system.add.json?${params}`,
    { method: 'GET' }
  )

  if (!response.ok) {
    throw new Error(`Bitrix24 notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
