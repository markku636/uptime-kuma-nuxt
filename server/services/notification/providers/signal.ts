// server/services/notification/providers/signal.ts
export interface SignalConfig {
  signalUrl: string
  number: string
  recipients: string
}

export const signalProvider = {
  name: 'Signal',
  
  async send(config: SignalConfig, title: string, message: string): Promise<void> {
    const recipients = config.recipients.split(',').map(r => r.trim())
    
    const response = await fetch(`${config.signalUrl}/v2/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: config.number,
        recipients,
        message: `${title}\n\n${message}`
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Signal notification failed: ${response.status} - ${errorText}`)
    }
  }
}
