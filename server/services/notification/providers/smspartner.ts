// SMS Partner notification provider (French SMS service)

interface SMSPartnerConfig {
  smspartnerApikey: string
  smspartnerSenderName: string
  smspartnerPhoneNumber: string
}

export async function send(
  config: SMSPartnerConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://api.smspartner.fr/v1/send'
  
  // Remove non-ASCII and limit to 639 chars
  const cleanMsg = message.replace(/[^\x00-\x7F]/g, '').substring(0, 639)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cache-control': 'no-cache',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      apiKey: config.smspartnerApikey,
      sender: config.smspartnerSenderName.substring(0, 11),
      phoneNumbers: config.smspartnerPhoneNumber,
      message: cleanMsg
    })
  })

  if (!response.ok) {
    throw new Error(`SMS Partner notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.success !== true) {
    throw new Error(`SMS Partner notification failed: ${result.response?.status}`)
  }
}

export default { send }
