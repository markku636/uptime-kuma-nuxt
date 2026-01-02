// GoAlert notification provider
// Open source on-call scheduling and notification

interface GoAlertConfig {
  goAlertBaseURL: string
  goAlertToken: string
}

export async function send(
  config: GoAlertConfig,
  _title: string,
  message: string,
  status: 'up' | 'down' | 'info'
): Promise<void> {
  let baseUrl = config.goAlertBaseURL
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1)
  }

  const formData = new FormData()
  formData.append('summary', message)
  
  // Close alert on recovery
  if (status === 'up') {
    formData.append('action', 'close')
  }

  const response = await fetch(
    `${baseUrl}/api/v2/generic/incoming?token=${config.goAlertToken}`,
    {
      method: 'POST',
      body: formData
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`GoAlert notification failed: ${errorText}`)
  }
}

export default { send }
