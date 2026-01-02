// LunaSea notification provider
// Self-hosted media server manager with push notifications

interface LunaSeaConfig {
  lunaSeaTarget: string // device or user token
}

export async function send(
  config: LunaSeaConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  const url = 'https://notify.lunasea.app/v1'
  
  const statusEmoji = status === 'down' ? '🔴 Down' : status === 'up' ? '✅ Up' : 'ℹ️ Info'
  
  const data = {
    title: `UptimeKuma Alert: ${title}`,
    body: `[${statusEmoji}] ${message}`
  }

  const response = await fetch(`${url}/custom/${config.lunaSeaTarget}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    throw new Error(`LunaSea notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
