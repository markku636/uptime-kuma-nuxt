// GTX Messaging notification provider

interface GTXMessagingConfig {
  gtxMessagingApiKey: string
  gtxMessagingFrom: string
  gtxMessagingTo: string
}

export async function send(
  config: GTXMessagingConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://rest.gtx-messaging.net/smsc/sendsms'
  const cleanMsg = message.replace(/[^\x00-\x7F]/g, '')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${btoa(config.gtxMessagingApiKey + ':')}`
    },
    body: JSON.stringify({
      from: config.gtxMessagingFrom,
      to: config.gtxMessagingTo,
      text: cleanMsg
    })
  })

  if (!response.ok) {
    const result = await response.json().catch(() => ({}))
    throw new Error(`GTX Messaging notification failed: ${response.status} - ${result?.error || response.statusText}`)
  }
}

export default { send }
