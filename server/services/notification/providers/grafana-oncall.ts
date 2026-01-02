// server/services/notification/providers/grafana-oncall.ts
export interface GrafanaOnCallConfig {
  webhookUrl: string
}

export const grafanaOncallProvider = {
  name: 'Grafana OnCall',
  
  async send(config: GrafanaOnCallConfig, title: string, message: string, status: 'up' | 'down'): Promise<void> {
    const payload = {
      alert_uid: `uptime-kuma-${Date.now()}`,
      title,
      message,
      state: status === 'up' ? 'resolved' : 'alerting',
      link_to_upstream_details: '',
      image_url: ''
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
      throw new Error(`Grafana OnCall notification failed: ${response.status} - ${errorText}`)
    }
  }
}
