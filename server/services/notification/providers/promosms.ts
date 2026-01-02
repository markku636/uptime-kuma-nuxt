// PromoSMS notification provider (Polish SMS service)

interface PromoSMSConfig {
  promosmsLogin: string
  promosmsPassword: string
  promosmsPhoneNumber: string
  promosmsSenderName: string
  promosmsSMSType: string
  promosmsAllowLongSMS?: boolean
}

export async function send(
  config: PromoSMSConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://promosms.com/api/rest/v3_2/sms'
  
  // Remove non-ASCII and limit length
  const cleanMsg = message.replace(/[^\x00-\x7F]/g, '')
  const maxLen = config.promosmsAllowLongSMS ? 639 : 159
  
  const auth = btoa(`${config.promosmsLogin}:${config.promosmsPassword}`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'Accept': 'text/json'
    },
    body: JSON.stringify({
      recipients: [config.promosmsPhoneNumber],
      text: cleanMsg.substring(0, maxLen),
      'long-sms': config.promosmsAllowLongSMS || false,
      type: Number(config.promosmsSMSType),
      sender: config.promosmsSenderName
    })
  })

  if (!response.ok) {
    throw new Error(`PromoSMS notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.response?.status !== 0) {
    throw new Error(`PromoSMS notification failed: status ${result.response?.status}`)
  }
}

export default { send }
