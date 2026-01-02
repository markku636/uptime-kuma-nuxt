// Octopush SMS notification provider

interface OctopushConfig {
  octopushVersion?: '1' | '2'
  // V2
  octopushAPIKey?: string
  octopushLogin?: string
  octopushPhoneNumber?: string
  octopushSMSType?: string
  octopushSenderName?: string
  // V1
  octopushDMLogin?: string
  octopushDMAPIKey?: string
  octopushDMPhoneNumber?: string
  octopushDMSenderName?: string
  octopushDMSMSType?: string
}

export async function send(
  config: OctopushConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const cleanMsg = message.replace(/[^\x00-\x7F]/g, '')

  if (config.octopushVersion === '1') {
    // V1 API
    const params = new URLSearchParams({
      user_login: config.octopushDMLogin || '',
      api_key: config.octopushDMAPIKey || '',
      sms_recipients: config.octopushDMPhoneNumber || '',
      sms_sender: config.octopushDMSenderName || '',
      sms_type: config.octopushDMSMSType === 'sms_premium' ? 'FR' : 'XXX',
      transactional: '1',
      sms_text: cleanMsg
    })

    const response = await fetch(`https://www.octopush-dm.com/api/sms/json?${params}`, {
      method: 'POST',
      headers: { 'cache-control': 'no-cache' }
    })

    if (!response.ok) {
      throw new Error(`Octopush notification failed: ${response.status}`)
    }
  } else {
    // V2 API (default)
    const data = {
      recipients: [{ phone_number: config.octopushPhoneNumber }],
      text: cleanMsg,
      type: config.octopushSMSType,
      purpose: 'alert',
      sender: config.octopushSenderName
    }

    const response = await fetch('https://api.octopush.com/v1/public/sms-campaign/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': config.octopushAPIKey || '',
        'api-login': config.octopushLogin || '',
        'cache-control': 'no-cache'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error(`Octopush notification failed: ${response.status}`)
    }
  }
}

export default { send }
