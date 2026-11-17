// server/services/monitor/screenshots.ts
// The latest screenshot of each real-browser monitor, kept in memory (one PNG
// per monitor, replaced on every check, gone after a restart).

export interface Screenshot {
  png: Buffer
  time: Date
}

const MAX_BYTES = 5 * 1024 * 1024
const store = new Map<number, Screenshot>()

export function saveScreenshot(monitorId: number, png: Buffer): void {
  if (png.length > MAX_BYTES) return
  store.set(monitorId, { png, time: new Date() })
}

export function getScreenshot(monitorId: number): Screenshot | null {
  return store.get(monitorId) ?? null
}

export function deleteScreenshot(monitorId: number): void {
  store.delete(monitorId)
}
