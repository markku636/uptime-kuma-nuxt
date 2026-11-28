import { runtimeState } from '../services/monitor/runtime'
import { pollBrunoTestSchedules } from '../services/bruno/test-scheduler'

export default defineNitroPlugin(() => {
  const timer = setInterval(async () => {
    if (!runtimeState.ready || runtimeState.draining) return
    try { await pollBrunoTestSchedules() } catch { /* scheduler must never crash the app */ }
  }, 30_000)
  timer.unref()
})
