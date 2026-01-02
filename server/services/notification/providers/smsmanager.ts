// SMS Manager notification provider (Czech SMS service)

interface SMSManagerConfig {
  smsmanagerApiKey: string
  smsmanagerNumbers: string
  smsmanagerMessageType: string
}

export async function send(
  config: SMSManagerConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const cleanMsg = encodeURIComponent(message.replace(/[^\x00-\x7F]/g, ''))
  
  const url = `https://http-api.smsmanager.cz/Send?apikey=${config.smsmanagerApiKey}&message=${cleanMsg}&number=${config.smsmanagerNumbers}&gateway=${config.smsmanagerMessageType}`

  const response = await fetch(url, { method: 'GET' })

  if (!response.ok) {
    throw new Error(`SMS Manager notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
