// server/api/v1/health.get.ts

export default defineEventHandler(async () => {
  return {
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }
})
