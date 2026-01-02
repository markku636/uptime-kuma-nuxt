// FreeMobile SMS notification provider (French mobile operator)

interface FreeMobileConfig {
  freemobileUser: string
  freemobilePass: string
}

export async function send(
  config: FreeMobileConfig,
  _title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  // Replace emoji that FreeMobile doesn't support
  const cleanMsg = encodeURIComponent(message.replace('🔴', '⛔️'))
  
  const response = await fetch(
    `https://smsapi.free-mobile.fr/sendmsg?msg=${cleanMsg}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: config.freemobileUser,
        pass: config.freemobilePass
      })
    }
  )

  if (!response.ok) {
    throw new Error(`FreeMobile notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
