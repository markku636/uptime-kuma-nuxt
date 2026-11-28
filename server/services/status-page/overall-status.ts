// Checkly-style incident impact → overall status mapping.
const INCIDENT_STATUS: Record<string, string> = {
  major: 'major-outage',
  partial: 'partial-outage',
  degraded: 'degraded-performance',
  maintenance: 'maintenance',
}
const SEVERITY = ['operational', 'maintenance', 'degraded-performance', 'partial-outage', 'major-outage']

export function raiseStatusByIncidents(current: string, incidents: Array<{ impact?: string | null; updates?: Array<{ status?: string }> }>): string {
  let status = SEVERITY.includes(current) ? current : 'unknown'
  for (const incident of incidents) {
    if (incident.updates?.[0]?.status === 'resolved') continue
    const candidate = INCIDENT_STATUS[String(incident.impact || '')]
    if (candidate && SEVERITY.indexOf(candidate) > SEVERITY.indexOf(status)) status = candidate
  }
  return status
}
