// CallMeBot notification provider

interface CallMeBotConfig {
  callMeBotEndpoint: string
}

export async function send(
  config: CallMeBotConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = new URL(config.callMeBotEndpoint)
  url.searchParams.set('text', message)

  const response = await fetch(url.toString(), { method: 'GET' })

  if (!response.ok) {
    throw new Error(`CallMeBot notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
