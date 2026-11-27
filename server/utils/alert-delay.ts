export const ALERT_DELAY_SETTING_KEY = 'alertDelayMinutes'

/** Bounded delay in minutes before a DOWN alert is delivered. 0 = immediate. */
export function parseAlertDelayMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1440 ? parsed : 0
}

export async function readAlertDelayMinutes(db: any): Promise<number> {
  const setting = await db.setting.findUnique({ where: { key: ALERT_DELAY_SETTING_KEY }, select: { value: true } })
  return parseAlertDelayMinutes(setting?.value)
}
