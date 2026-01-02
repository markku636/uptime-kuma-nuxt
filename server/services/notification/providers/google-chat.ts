// server/services/notification/providers/google-chat.ts
export interface GoogleChatConfig {
  webhookUrl: string
}

export const googleChatProvider = {
  name: 'Google Chat',
  
  async send(config: GoogleChatConfig, title: string, message: string, status: 'up' | 'down'): Promise<void> {
    const statusEmoji = status === 'up' ? '✅' : '🔴'
    
    // Google Chat card message format
    const payload = {
      cards: [{
        header: {
          title: `${statusEmoji} ${title}`,
          subtitle: status === 'up' ? 'Service is UP' : 'Service is DOWN'
        },
        sections: [{
          widgets: [{
            textParagraph: {
              text: message
            }
          }, {
            keyValue: {
              topLabel: 'Status',
              content: status.toUpperCase(),
              contentMultiline: false
            }
          }, {
            keyValue: {
              topLabel: 'Time',
              content: new Date().toISOString(),
              contentMultiline: false
            }
          }]
        }]
      }]
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
      throw new Error(`Google Chat notification failed: ${response.status} - ${errorText}`)
    }
  }
}
