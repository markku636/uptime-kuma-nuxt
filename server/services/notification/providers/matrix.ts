// server/services/notification/providers/matrix.ts
import type { NotificationMessage } from '../sender'

export const matrixProvider = {
  async send(config: { homeserverUrl: string; accessToken: string; roomId: string }, message: NotificationMessage) {
    if (!config.homeserverUrl || !config.accessToken || !config.roomId) {
      throw new Error('Matrix homeserver URL, access token, and room ID are required')
    }

    const url = `${config.homeserverUrl.replace(/\/$/, '')}/_matrix/client/r0/rooms/${encodeURIComponent(config.roomId)}/send/m.room.message?access_token=${config.accessToken}`

    const emoji = message.status === 'up' ? '✅' : '❌'
    
    const body = {
      msgtype: 'm.text',
      body: `${emoji} ${message.title}\n\n${message.body}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<strong>${emoji} ${message.title}</strong><br/><br/>${message.body.replace(/\n/g, '<br/>')}`
    }

    await $fetch(url, {
      method: 'POST',
      body
    })
  }
}
