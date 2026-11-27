/** Average ping of the latest bounded observations; failed/unknown rows are ignored. */
export function recentAveragePing(heartbeats: Array<{ ping?: unknown }> | null | undefined, limit = 10): number | null {
  if (!Array.isArray(heartbeats)) return null
  const values = heartbeats.slice(-Math.max(1, Math.min(50, limit)))
    .map(row => row?.ping)
    .filter(value => value !== null && value !== undefined && value !== '')
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 300000)
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}
