// ServerChan notification provider
// Chinese push notification service (方糖)

interface ServerChanConfig {
  serverChanSendKey: string
}

export async function send(
  config: ServerChanConfig,
  title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  // ServerChan3 (sctp keys) requires different endpoint
  const matchResult = config.serverChanSendKey.match(/^sctp(\d+)t/i)
  const url = matchResult && matchResult[1]
    ? `https://${matchResult[1]}.push.ft07.com/send/${config.serverChanSendKey}.send`
    : `https://sctapi.ftqq.com/${config.serverChanSendKey}.send`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      desp: message
    })
  })

  if (!response.ok) {
    throw new Error(`ServerChan notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
