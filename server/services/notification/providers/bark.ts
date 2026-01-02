// Bark notification provider
// iOS push notifications via Apple Push Notification service

interface BarkConfig {
  barkEndpoint: string
  barkGroup?: string
  barkSound?: string
}

export async function send(
  config: BarkConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  let endpoint = config.barkEndpoint
  
  // Remove trailing slash
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1)
  }

  const params: Record<string, string> = {
    title,
    body: message,
    icon: 'https://github.com/louislam/uptime-kuma/raw/master/public/icon.png'
  }
  
  if (config.barkGroup) {
    params.group = config.barkGroup
  }
  
  if (config.barkSound) {
    params.sound = config.barkSound
  }
  
  // Add status-based sound if not specified
  if (!config.barkSound) {
    params.sound = status === 'down' ? 'alarm' : 'healthnotification'
  }
  
  const queryString = new URLSearchParams(params).toString()
  
  const response = await fetch(`${endpoint}/push?${queryString}`, {
    method: 'GET'
  })

  if (!response.ok) {
    throw new Error(`Bark notification failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()
  if (result.code !== 200) {
    throw new Error(`Bark notification failed: ${result.message}`)
  }
}

export default { send }
