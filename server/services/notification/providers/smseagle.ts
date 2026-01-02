// SMSEagle notification provider (SMS gateway hardware)

interface SMSEagleConfig {
  smseagleUrl: string
  smseagleToken: string
  smseagleRecipientTo: string
  smseaglePriority?: number
  smseagleEncoding?: string
  smseagleRecipientType?: 'smseagle-to' | 'smseagle-group' | 'smseagle-contact'
}

export async function send(
  config: SMSEagleConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = new URL('/api/v2/messages/sms', config.smseagleUrl)
  
  const data: Record<string, any> = {
    text: message,
    priority: config.smseaglePriority || 0,
    encoding: config.smseagleEncoding || 'standard'
  }

  // Set recipient based on type
  if (config.smseagleRecipientType === 'smseagle-contact') {
    data.contacts_name = config.smseagleRecipientTo
  } else if (config.smseagleRecipientType === 'smseagle-group') {
    data.groups_name = config.smseagleRecipientTo
  } else {
    data.to = [config.smseagleRecipientTo]
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'access-token': config.smseagleToken
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`SMSEagle notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
