export const INCIDENT_UPDATE_STATUSES = ['investigating', 'identified', 'monitoring', 'resolved', 'update'] as const
export type IncidentUpdateStatus = typeof INCIDENT_UPDATE_STATUSES[number]

/** Bound user input before it reaches the database or a public status page. */
export function parseIncidentUpdateStatus(value: unknown): IncidentUpdateStatus | null {
  return typeof value === 'string' && (INCIDENT_UPDATE_STATUSES as readonly string[]).includes(value)
    ? value as IncidentUpdateStatus
    : null
}

export function parseIncidentUpdateMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const message = value.trim()
  return message.length >= 1 && message.length <= 5000 ? message : null
}
