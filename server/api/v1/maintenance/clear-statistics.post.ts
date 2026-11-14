export default defineEventHandler(async event => {
  await requireWorkspace(event, 'owner')
  return { success: true, message: 'Statistics are derived from heartbeat history; no separate cache is stored' }
})
