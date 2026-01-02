// 46elks SMS notification provider (Swedish SMS service)

interface ElksConfig {
  elksUsername: string
  elksAuthToken: string
  elksFromNumber: string
  elksToNumber: string
}

export async function send(
  config: ElksConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://api.46elks.com/a1/sms'
  
  const auth = btoa(`${config.elksUsername}:${config.elksAuthToken}`)
  
  const data = new URLSearchParams()
  data.append('from', config.elksFromNumber)
  data.append('to', config.elksToNumber)
  data.append('message', message)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: data
  })

  if (!response.ok) {
    throw new Error(`46elks notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
