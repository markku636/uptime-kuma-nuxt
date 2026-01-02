// SMS Planet notification provider (Polish SMS service)

interface SMSPlanetConfig {
  smsplanetApiToken: string
  smsplanetSenderName: string
  smsplanetPhoneNumbers: string
}

export async function send(
  config: SMSPlanetConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://api2.smsplanet.pl/sms'
  
  // Replace emoji that may not display correctly
  const cleanMsg = message.replace(/🔴/, '❌')

  const formData = new FormData()
  formData.append('from', config.smsplanetSenderName)
  formData.append('to', config.smsplanetPhoneNumbers)
  formData.append('msg', cleanMsg)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.smsplanetApiToken}`
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error(`SMS Planet notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (!result.messageId) {
    throw new Error(`SMS Planet notification failed: ${result.errorMsg || 'Unknown error'}`)
  }
}

export default { send }
