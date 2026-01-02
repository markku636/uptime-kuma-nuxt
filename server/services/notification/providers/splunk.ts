// server/services/notification/providers/splunk.ts
export interface SplunkConfig {
  serverUrl: string
  token: string
  source?: string
  sourceType?: string
  index?: string
}

export const splunkProvider = {
  name: 'Splunk',
  
  async send(config: SplunkConfig, title: string, message: string, status: 'up' | 'down'): Promise<void> {
    const url = `${config.serverUrl}/services/collector/event`

    const event = {
      event: {
        title,
        message,
        status,
        timestamp: new Date().toISOString()
      },
      source: config.source || 'uptime-kuma',
      sourcetype: config.sourceType || '_json',
      index: config.index || 'main'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Splunk ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Splunk notification failed: ${response.status} - ${errorText}`)
    }
  }
}
