// Zoho Cliq notification provider
// Team collaboration software

interface ZohoCliqConfig {
  zohoCliqWebhookUrl: string
}

export async function send(
  config: ZohoCliqConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const statusIcon = status === 'down' ? '🔴' : status === 'up' ? '✅' : 'ℹ️'
  const statusText = status === 'down' ? 'went down' : status === 'up' ? 'is back online' : ''
  
  const payload: string[] = []
  
  if (status !== 'info') {
    payload.push(`${statusIcon} [${title}] ${statusText}`)
  } else {
    payload.push(`${statusIcon} ${title}`)
  }
  
  payload.push(`*Description:* ${message}`)

  const response = await fetch(config.zohoCliqWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: payload.join('\n')
    })
  })

  if (!response.ok) {
    throw new Error(`Zoho Cliq notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
