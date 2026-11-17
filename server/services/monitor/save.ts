// server/services/monitor/save.ts
// Turning validated monitor fields into Prisma writes (create and update).
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { columnData } from './fields'

const JSON_COLUMNS = ['headers', 'acceptedStatuscodes', 'kafkaBrokers', 'rabbitmqNodes', 'tlsExpiryDays'] as const

/** Column data for Prisma: a null Json column is stored as SQL NULL */
export function prismaColumns(data: Record<string, any>): Record<string, any> {
  const columns = columnData(data)
  for (const key of JSON_COLUMNS) {
    if (columns[key] === null) columns[key] = Prisma.DbNull
  }
  return columns
}

/**
 * Replace the monitor's tags / notifications with the given ids (only the
 * user's own). `undefined` leaves a set as it is; `null` or `[]` empties it.
 */
export async function replaceMonitorRelations(
  userId: number,
  monitorId: number,
  sets: { tags?: number[] | null; notifications?: number[] | null },
) {
  const ops: Prisma.PrismaPromise<unknown>[] = []
  if (sets.tags !== undefined) {
    const ids = sets.tags?.length
      ? (await prisma.tag.findMany({ where: { id: { in: sets.tags }, userId }, select: { id: true } })).map(t => t.id)
      : []
    ops.push(
      prisma.monitorTag.deleteMany({ where: { monitorId, tagId: { notIn: ids } } }),
      prisma.monitorTag.createMany({ data: ids.map(tagId => ({ monitorId, tagId })), skipDuplicates: true }),
    )
  }
  if (sets.notifications !== undefined) {
    const ids = sets.notifications?.length
      ? (await prisma.notification.findMany({ where: { id: { in: sets.notifications }, userId }, select: { id: true } })).map(n => n.id)
      : []
    ops.push(
      prisma.monitorNotification.deleteMany({ where: { monitorId, notificationId: { notIn: ids } } }),
      prisma.monitorNotification.createMany({ data: ids.map(notificationId => ({ monitorId, notificationId })), skipDuplicates: true }),
    )
  }
  if (ops.length) await prisma.$transaction(ops)
}
