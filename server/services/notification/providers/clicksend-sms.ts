// ClickSend SMS notification provider
// SMS marketing and communication service

interface ClickSendSMSConfig {
  clicksendsmsLogin: string
  clicksendsmsPassword: string
  clicksendsmsToNumber: string
  clicksendsmsSenderName?: string
}

export async function send(
  config: ClickSendSMSConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://rest.clicksend.com/v3/sms/send'
  
  // Remove non-ASCII characters for SMS compatibility
  const cleanMessage = message.replace(/[^\x00-\x7F]/g, '')

  const auth = btoa(`${config.clicksendsmsLogin}:${config.clicksendsmsPassword}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Accept': 'text/json'
    },
    body: JSON.stringify({
      messages: [{
        body: cleanMessage,
        to: config.clicksendsmsToNumber,
        source: 'uptime-kuma',
        from: config.clicksendsmsSenderName || 'UptimeKuma'
      }]
    })
  })

  if (!response.ok) {
    throw new Error(`ClickSend SMS notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.data?.messages?.[0]?.status !== 'SUCCESS') {
    throw new Error(`ClickSend SMS notification failed: ${result.data?.messages?.[0]?.status}`)
  }
}

export default { send }
