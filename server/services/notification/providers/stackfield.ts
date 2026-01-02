// Stackfield notification provider
// Secure collaboration and project management

interface StackfieldConfig {
  stackfieldWebhookURL: string
}

export async function send(
  config: StackfieldConfig,
  title: string,
  message: string,
  _status: 'up' | 'down' | 'info'
): Promise<void> {
  // Stackfield formatting: + for underline, * for bold
  let textMsg = '+Uptime Kuma Alert+'

  if (title) {
    textMsg += `\n*${title}*`
  }

  textMsg += `\n${message}`

  const response = await fetch(config.stackfieldWebhookURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Title: textMsg
    })
  })

  if (!response.ok) {
    throw new Error(`Stackfield notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
