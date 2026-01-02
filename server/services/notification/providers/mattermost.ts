// server/services/notification/providers/mattermost.ts
export interface MattermostConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconUrl?: string
}

export const mattermostProvider = {
  name: 'Mattermost',
  
  async send(config: MattermostConfig, title: string, message: string, status: 'up' | 'down'): Promise<void> {
    const color = status === 'up' ? '#2ecc71' : '#e74c3c'
    
    const payload: any = {
      text: title,
      attachments: [{
        color,
        text: message,
        fallback: `${title}: ${message}`
      }]
    }

    if (config.channel) {
      payload.channel = config.channel
    }

    if (config.username) {
      payload.username = config.username
    }

    if (config.iconUrl) {
      payload.icon_url = config.iconUrl
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Mattermost notification failed: ${response.status} - ${errorText}`)
    }
  }
}
