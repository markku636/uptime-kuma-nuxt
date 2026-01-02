// Cellsynt SMS notification provider (Swedish SMS service)

interface CellsyntConfig {
  cellsyntLogin: string
  cellsyntPassword: string
  cellsyntDestination: string
  cellsyntOriginatortype: string
  cellsyntOriginator: string
  cellsyntAllowLongSMS?: boolean
}

export async function send(
  config: CellsyntConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const cleanMsg = message.replace(/[^\x00-\x7F]/g, '')
  
  const params = new URLSearchParams({
    username: config.cellsyntLogin,
    password: config.cellsyntPassword,
    destination: config.cellsyntDestination,
    text: cleanMsg,
    originatortype: config.cellsyntOriginatortype,
    originator: config.cellsyntOriginator,
    allowconcat: config.cellsyntAllowLongSMS ? '6' : '1'
  })

  const response = await fetch('https://se-1.cellsynt.net/sms.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  if (!response.ok) {
    throw new Error(`Cellsynt notification failed: ${response.status} ${response.statusText}`)
  }
  
  const text = await response.text()
  if (text.includes('Error:')) {
    throw new Error(`Cellsynt notification failed: ${text}`)
  }
}

export default { send }
