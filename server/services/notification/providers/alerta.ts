// Alerta notification provider
// Monitoring and alerting tool

interface AlertaConfig {
  alertaApiEndpoint: string
  alertaApiKey: string
  alertaEnvironment: string
  alertaAlertState?: string // severity for down state
  alertaRecoverState?: string // severity for up state
}

export async function send(
  config: AlertaConfig,
  title: string,
  message: string,
  status: 'up' | 'down' | 'info',
  monitor?: { id: number; name: string; type: string }
): Promise<void> {
  const baseData = {
    environment: config.alertaEnvironment,
    correlate: [] as string[],
    service: ['UptimeKuma'],
    value: 'Timeout',
    tags: ['uptimekuma'],
    attributes: {},
    origin: 'uptimekuma',
    type: 'exceptionAlert'
  }

  let postData: Record<string, any>

  if (!monitor) {
    // Test message
    postData = {
      ...baseData,
      event: 'msg',
      text: message,
      group: 'uptimekuma-msg',
      resource: title || 'Message',
      severity: 'informational'
    }
  } else {
    postData = {
      ...baseData,
      correlate: ['service_up', 'service_down'],
      event: monitor.type,
      group: `uptimekuma-${monitor.type}`,
      resource: monitor.name
    }

    if (status === 'down') {
      postData.severity = config.alertaAlertState || 'critical'
      postData.text = `Service ${monitor.type} is down. ${message}`
    } else {
      postData.severity = config.alertaRecoverState || 'cleared'
      postData.text = `Service ${monitor.type} is up. ${message}`
    }
  }

  const response = await fetch(config.alertaApiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Authorization': `Key ${config.alertaApiKey}`
    },
    body: JSON.stringify(postData)
  })

  if (!response.ok) {
    throw new Error(`Alerta notification failed: ${response.status} ${response.statusText}`)
  }
}

export default { send }
