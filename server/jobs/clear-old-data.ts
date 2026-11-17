// server/jobs/clear-old-data.ts
// Clears old heartbeat data from the database based on keepDataPeriodDays setting

import { prisma } from '../utils/prisma'
import { HISTORY_DEFAULT_DAYS } from '../services/monitor/history'

const DEFAULT_KEEP_PERIOD = HISTORY_DEFAULT_DAYS

/**
 * Clears old data from the heartbeat table.
 * Reads the keepDataPeriodDays setting and deletes heartbeats older than that period.
 * @returns {Promise<void>}
 */
export async function clearOldData(): Promise<void> {
  console.log('[ClearOldData] Starting cleanup job...')

  try {
    // Get keepDataPeriodDays setting
    const setting = await prisma.setting.findUnique({
      where: { key: 'keepDataPeriodDays' }
    })

    let keepDays = DEFAULT_KEEP_PERIOD

    if (setting?.value) {
      const parsed = parseInt(setting.value, 10)
      if (!isNaN(parsed)) {
        keepDays = parsed
      } else {
        console.warn('[ClearOldData] Failed to parse keepDataPeriodDays, using default:', DEFAULT_KEEP_PERIOD)
      }
    } else {
      // Create default setting if not exists
      await prisma.setting.upsert({
        where: { key: 'keepDataPeriodDays' },
        create: { key: 'keepDataPeriodDays', value: String(DEFAULT_KEEP_PERIOD) },
        update: {}
      })
      console.log('[ClearOldData] Created default keepDataPeriodDays setting:', DEFAULT_KEEP_PERIOD)
    }

    // If keepDays is less than 1, data deletion is disabled
    if (keepDays < 1) {
      console.log('[ClearOldData] Data deletion disabled (keepDataPeriodDays < 1)')
      return
    }

    console.log(`[ClearOldData] Clearing data older than ${keepDays} days...`)

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - keepDays)

    // Delete old heartbeats
    const heartbeatResult = await prisma.heartbeat.deleteMany({
      where: {
        time: { lt: cutoffDate }
      }
    })

    console.log(`[ClearOldData] Deleted ${heartbeatResult.count} old heartbeats`)

    // Note: stat_daily table doesn't exist in NuxtJS version
    // If you need it, add the model to schema.prisma first

    console.log('[ClearOldData] Cleanup completed successfully')
  } catch (error) {
    console.error('[ClearOldData] Failed to clear old data:', error)
  }
}
