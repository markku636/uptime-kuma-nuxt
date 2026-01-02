// HeiiOnCall notification provider

interface HeiiOnCallConfig {
  heiiOnCallApiKey: string
  heiiOnCallTriggerId: string
}

export async function send(
  config: HeiiOnCallConfig,
  _title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const heiiUrl = `https://heiioncall.com/triggers/${config.heiiOnCallTriggerId}/`
  const endpoint = status === 'up' ? 'resolve' : 'alert'
  
  const payload = { msg: message }

  const response = await fetch(heiiUrl + endpoint, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.heiiOnCallApiKey}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`HeiiOnCall notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
