// server/services/notification/providers/rocket-chat.ts
export interface RocketChatConfig {
  webhookUrl: string
  username?: string
  iconEmoji?: string
}

export const rocketChatProvider = {
  name: 'Rocket.Chat',
  
  async send(config: RocketChatConfig, title: string, message: string, status: 'up' | 'down'): Promise<void> {
    const color = status === 'up' ? '#2ecc71' : '#e74c3c'
    
    const payload: any = {
      text: title,
      attachments: [{
        color,
        text: message,
        ts: new Date().toISOString()
      }]
    }

    if (config.username) {
      payload.username = config.username
    }

    if (config.iconEmoji) {
      payload.emoji = config.iconEmoji
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
      throw new Error(`Rocket.Chat notification failed: ${response.status} - ${errorText}`)
    }
  }
}
