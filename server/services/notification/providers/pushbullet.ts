// server/services/notification/providers/pushbullet.ts
export interface PushbulletConfig {
  accessToken: string
  deviceIden?: string
}

export const pushbulletProvider = {
  name: 'Pushbullet',
  
  async send(config: PushbulletConfig, title: string, message: string): Promise<void> {
    const payload: any = {
      type: 'note',
      title,
      body: message
    }

    if (config.deviceIden) {
      payload.device_iden = config.deviceIden
    }

    const response = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: {
        'Access-Token': config.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Pushbullet notification failed: ${errorData.error?.message || response.status}`)
    }
  }
}
