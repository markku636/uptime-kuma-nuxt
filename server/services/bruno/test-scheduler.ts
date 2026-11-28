import { prisma } from '~/server/utils/prisma'
import { runBrunoTestSuite } from './test-runner'
import { withTestRunCapacity } from './test-guard'

let polling = false

/** Polls opt-in suite schedules. The DB unique running index prevents cross-pod duplicates. */
export async function pollBrunoTestSchedules(now = new Date()) {
  if (polling) return
  polling = true
  try {
    const due = await prisma.brunoTestSuite.findMany({
      where: { scheduleIntervalSec: { gt: 0 }, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] },
      orderBy: { nextRunAt: 'asc' },
      take: 50,
    })
    for (const suite of due) {
      try {
        await withTestRunCapacity(suite.createdBy, () => runBrunoTestSuite({
          workspaceId: suite.workspaceId, environmentId: suite.environmentId, user: { id: suite.createdBy },
        }, suite.id))
      } catch {
        // Another pod may be running it, or capacity is full: skip this tick and retry next time.
      }
      const interval = Number(suite.scheduleIntervalSec) || 300
      await prisma.brunoTestSuite.update({ where: { id: suite.id },
        data: { nextRunAt: new Date(Date.now() + interval * 1000) } })
    }
    return due.length
  } finally {
    polling = false
  }
}
