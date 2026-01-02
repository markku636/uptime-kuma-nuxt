// server/services/notification/providers/home-assistant.ts
export interface HomeAssistantConfig {
  serverUrl: string
  accessToken: string
  notifyService?: string
}

export const homeAssistantProvider = {
  name: 'Home Assistant',
  
  async send(config: HomeAssistantConfig, title: string, message: string): Promise<void> {
    const service = config.notifyService || 'notify.notify'
    const url = `${config.serverUrl}/api/services/${service.replace('.', '/')}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        message
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Home Assistant notification failed: ${response.status} - ${errorText}`)
    }
  }
}
