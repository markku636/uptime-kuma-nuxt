// YZJ (云之家) notification provider - Chinese enterprise communication platform

interface YZJConfig {
  yzjWebHookUrl: string
}

export async function send(
  config: YZJConfig,
  title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  const response = await fetch(config.yzjWebHookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `${title}\n${message}`
    })
  })

  if (!response.ok) {
    throw new Error(`YZJ notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (!result.success) {
    throw new Error(`YZJ notification failed: ${result.msg || 'Unknown error'}`)
  }
}

export default { send }
