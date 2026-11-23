/** Canonical setting key shared by the settings UI and the notification engine. */
export const TLS_EXPIRY_SETTING_KEY = 'tlsExpiryNotifyDays'
export const DEFAULT_TLS_EXPIRY_DAYS = [7, 14, 21]

/** Accept JSON arrays (current format) and legacy comma-separated values. */
export function parseTlsExpiryDays(value: unknown): number[] {
  let raw: unknown = value
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value)
    } catch {
      raw = value.split(',').map(item => Number(item.trim()))
    }
  }
  if (!Array.isArray(raw)) return [...DEFAULT_TLS_EXPIRY_DAYS]
  const days = [...new Set(raw
    .map(item => Number(item))
    .filter(item => Number.isInteger(item) && item > 0 && item <= 365))]
    .sort((a, b) => a - b)
  return days.length ? days : [...DEFAULT_TLS_EXPIRY_DAYS]
}
