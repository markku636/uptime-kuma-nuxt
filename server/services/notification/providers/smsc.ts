// SMSC notification provider (Kazakhstan SMS service)

interface SMSCConfig {
  smscLogin: string
  smscPassword: string
  smscToNumber: string
  smscSenderName?: string
  smscTranslit?: string
}

export async function send(
  config: SMSCConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const cleanMsg = encodeURIComponent(message.replace(/[^\x00-\x7F]/g, ''))
  
  const params = [
    'fmt=3',
    `translit=${config.smscTranslit || '0'}`,
    `login=${config.smscLogin}`,
    `psw=${config.smscPassword}`,
    `phones=${config.smscToNumber}`,
    `mes=${cleanMsg}`
  ]
  
  if (config.smscSenderName) {
    params.push(`sender=${config.smscSenderName}`)
  }

  const response = await fetch(`https://smsc.kz/sys/send.php?${params.join('&')}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/json'
    }
  })

  if (!response.ok) {
    throw new Error(`SMSC notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.id === undefined) {
    throw new Error(`SMSC notification failed: ${result.error} (code ${result.error_code})`)
  }
}

export default { send }
