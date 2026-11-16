// server/services/maintenance/service.ts
// Single entry point for maintenance CRUD. Used by both the REST API
// (server/api/v1/maintenances) and the Socket.IO handlers so that every
// change re-schedules timers and notifies connected dashboards.

import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import {
  MAINTENANCE_STRATEGIES,
  SAME_AS_SERVER,
  isValidTimezone,
  resolveTimezone,
  validateCron,
  wallTimeToDate,
} from './schedule'
import {
  maintenanceToPublicJSON,
  startMaintenanceJob,
  stopMaintenanceJob,
  type MaintenancePublicJSON,
} from './scheduler'
import {
  broadcastMaintenanceAdded,
  broadcastMaintenanceDeleted,
  broadcastMaintenanceUpdated,
} from '../socket'

export class MaintenanceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
  }
}

const timeOfDaySchema = z.object({
  hours: z.coerce.number().int().min(0).max(23),
  minutes: z.coerce.number().int().min(0).max(59),
})

const idListSchema = z
  .array(z.union([z.number(), z.object({ id: z.number() })]))
  .transform(list => [...new Set(list.map(item => (typeof item === 'number' ? item : item.id)))])

export const maintenanceInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(150),
    description: z.string().max(10_000).optional().default(''),
    strategy: z.enum(MAINTENANCE_STRATEGIES).default('manual'),
    active: z.boolean().optional(),
    intervalDay: z.coerce.number().int().min(1).max(3650).optional().default(1),
    // Wall-clock strings ("YYYY-MM-DD HH:mm") in the selected timezone
    dateRange: z.array(z.string().nullable().optional()).max(2).optional().default([]),
    timeRange: z.array(timeOfDaySchema).length(2).optional(),
    weekdays: z.array(z.coerce.number().int().min(0).max(7)).optional().default([]),
    daysOfMonth: z.array(z.union([z.coerce.number().int().min(1).max(31), z.string().regex(/^lastDay[1-4]$/)])).optional().default([]),
    cron: z.string().trim().optional().default(''),
    durationMinutes: z.coerce.number().int().min(1).max(60 * 24 * 31).optional(),
    timezoneOption: z.string().optional().default(SAME_AS_SERVER),
    monitors: idListSchema.optional().default([]),
    statusPages: idListSchema.optional().default([]),
  })
  .superRefine((data, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })

    if (!isValidTimezone(data.timezoneOption)) issue('timezoneOption', 'Invalid timezone')

    if (data.strategy === 'single' && (!data.dateRange[0] || !data.dateRange[1])) {
      issue('dateRange', 'Start and end date are required')
    }
    if (data.strategy === 'cron') {
      if (!validateCron(data.cron)) issue('cron', 'Invalid cron expression')
      if (!data.durationMinutes) issue('durationMinutes', 'Duration is required')
    }
    if (data.strategy.startsWith('recurring-') && !data.timeRange) {
      issue('timeRange', 'Time range is required')
    }
    if (data.strategy === 'recurring-weekday' && data.weekdays.length === 0) {
      issue('weekdays', 'Select at least one weekday')
    }
    if (data.strategy === 'recurring-day-of-month' && data.daysOfMonth.length === 0) {
      issue('daysOfMonth', 'Select at least one day')
    }
  })

export type MaintenanceInput = z.input<typeof maintenanceInputSchema>

export function parseMaintenanceInput(body: unknown) {
  const result = maintenanceInputSchema.safeParse(body)
  if (!result.success) {
    const first = result.error.issues[0]
    const field = first?.path?.join('.')
    throw new MaintenanceError(field ? `${field}: ${first.message}` : first?.message || 'Invalid input')
  }
  return result.data
}

type ParsedInput = ReturnType<typeof parseMaintenanceInput>

function toDbData(input: ParsedInput) {
  const tz = resolveTimezone({ timezoneOption: input.timezoneOption })
  const usesDateRange = input.strategy !== 'manual'
  const startDate = usesDateRange ? wallTimeToDate(input.dateRange[0], tz) : null
  const endDate = usesDateRange ? wallTimeToDate(input.dateRange[1], tz) : null

  if (startDate && endDate && endDate <= startDate) {
    throw new MaintenanceError('dateRange: End date must be after start date')
  }

  const isRecurring = input.strategy.startsWith('recurring-')

  return {
    title: input.title,
    description: input.description || null,
    strategy: input.strategy,
    intervalDay: input.intervalDay,
    startDate,
    endDate,
    dateRange: JSON.stringify(input.dateRange.slice(0, 2).map(v => v || null)),
    timeRange: isRecurring && input.timeRange ? JSON.stringify(input.timeRange) : null,
    weekdays: input.strategy === 'recurring-weekday' ? JSON.stringify(input.weekdays) : null,
    daysOfMonth: input.strategy === 'recurring-day-of-month' ? JSON.stringify(input.daysOfMonth) : null,
    cron: input.strategy === 'cron' ? input.cron : null,
    duration: input.strategy === 'cron' ? (input.durationMinutes ?? 60) * 60 : 3600,
    timezone: input.timezoneOption,
    timezoneOption: input.timezoneOption,
    timezoneOffset: null,
  }
}

const withRelations = {
  monitors: { select: { monitorId: true } },
  statusPages: { select: { statusPageId: true } },
} as const

async function assertOwnedIds(userId: number, monitorIds: number[], statusPageIds: number[]) {
  if (monitorIds.length) {
    const count = await prisma.monitor.count({ where: { id: { in: monitorIds }, userId } })
    if (count !== monitorIds.length) throw new MaintenanceError('monitors: Unknown monitor')
  }
  if (statusPageIds.length) {
    const count = await prisma.statusPage.count({ where: { id: { in: statusPageIds }, userId } })
    if (count !== statusPageIds.length) throw new MaintenanceError('statusPages: Unknown status page')
  }
}

async function findOwned(userId: number, id: number) {
  const maintenance = await prisma.maintenance.findFirst({ where: { id, userId }, include: withRelations })
  if (!maintenance) throw new MaintenanceError('Maintenance not found', 404)
  return maintenance
}

export async function listMaintenances(userId: number): Promise<MaintenancePublicJSON[]> {
  const rows = await prisma.maintenance.findMany({
    where: { userId },
    include: withRelations,
    orderBy: { id: 'desc' },
  })
  return Promise.all(rows.map(row => maintenanceToPublicJSON(row)))
}

export async function getMaintenance(userId: number, id: number): Promise<MaintenancePublicJSON> {
  return maintenanceToPublicJSON(await findOwned(userId, id))
}

export async function createMaintenance(userId: number, body: unknown): Promise<MaintenancePublicJSON> {
  const input = parseMaintenanceInput(body)
  await assertOwnedIds(userId, input.monitors, input.statusPages)

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.maintenance.create({
      data: { ...toDbData(input), active: input.active ?? true, userId },
    })
    if (input.monitors.length) {
      await tx.maintenanceMonitor.createMany({
        data: input.monitors.map(monitorId => ({ maintenanceId: row.id, monitorId })),
      })
    }
    if (input.statusPages.length) {
      await tx.maintenanceStatusPage.createMany({
        data: input.statusPages.map(statusPageId => ({ maintenanceId: row.id, statusPageId })),
      })
    }
    return tx.maintenance.findUniqueOrThrow({ where: { id: row.id }, include: withRelations })
  })

  await startMaintenanceJob(created)
  const json = await maintenanceToPublicJSON(created)
  broadcastMaintenanceAdded(userId, json)
  return json
}

export async function updateMaintenance(userId: number, id: number, body: unknown): Promise<MaintenancePublicJSON> {
  const existing = await findOwned(userId, id)
  const input = parseMaintenanceInput(body)
  await assertOwnedIds(userId, input.monitors, input.statusPages)

  const updated = await prisma.$transaction(async (tx) => {
    await tx.maintenance.update({
      where: { id },
      data: { ...toDbData(input), active: input.active ?? existing.active },
    })
    await tx.maintenanceMonitor.deleteMany({ where: { maintenanceId: id } })
    if (input.monitors.length) {
      await tx.maintenanceMonitor.createMany({
        data: input.monitors.map(monitorId => ({ maintenanceId: id, monitorId })),
      })
    }
    await tx.maintenanceStatusPage.deleteMany({ where: { maintenanceId: id } })
    if (input.statusPages.length) {
      await tx.maintenanceStatusPage.createMany({
        data: input.statusPages.map(statusPageId => ({ maintenanceId: id, statusPageId })),
      })
    }
    return tx.maintenance.findUniqueOrThrow({ where: { id }, include: withRelations })
  })

  await startMaintenanceJob(updated)
  const json = await maintenanceToPublicJSON(updated)
  broadcastMaintenanceUpdated(userId, json)
  return json
}

export async function setMaintenanceActive(userId: number, id: number, active: boolean): Promise<MaintenancePublicJSON> {
  await findOwned(userId, id)
  const updated = await prisma.maintenance.update({ where: { id }, data: { active }, include: withRelations })

  if (active) await startMaintenanceJob(updated)
  else stopMaintenanceJob(id)

  const json = await maintenanceToPublicJSON(updated)
  broadcastMaintenanceUpdated(userId, json)
  return json
}

export async function deleteMaintenance(userId: number, id: number): Promise<void> {
  await findOwned(userId, id)
  stopMaintenanceJob(id)
  // Relations are removed by ON DELETE CASCADE
  await prisma.maintenance.delete({ where: { id } })
  broadcastMaintenanceDeleted(userId, id)
}

/** Maintenances linked to a status page that are under maintenance right now (public) */
export async function listActiveMaintenancesForStatusPage(statusPageId: number): Promise<Omit<MaintenancePublicJSON, 'monitors' | 'statusPages'>[]> {
  const links = await prisma.maintenanceStatusPage.findMany({
    where: { statusPageId, maintenance: { active: true } },
    include: { maintenance: true },
  })
  const all = await Promise.all(links.map(link => maintenanceToPublicJSON(link.maintenance)))
  return all
    .filter(m => m.status === 'under-maintenance')
    .map(({ monitors: _m, statusPages: _s, ...publicFields }) => publicFields)
}

/** Translate service errors for h3 handlers */
export function toHttpError(error: unknown) {
  if (error instanceof MaintenanceError) {
    return createError({ statusCode: error.statusCode, message: error.message })
  }
  return error
}

/** Resolve the logged-in user id and run a service call, mapping errors to HTTP */
export async function handleMaintenanceRequest<T>(
  event: Parameters<typeof getUserSession>[0],
  fn: (userId: number) => Promise<T>,
): Promise<T> {
  const session = await getUserSession(event)
  const userId = Number((session?.user as { id?: number } | undefined)?.id)
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })
  try {
    return await fn(userId)
  } catch (error) {
    throw toHttpError(error)
  }
}

export function getMaintenanceIdParam(event: Parameters<typeof getRouterParam>[0]): number {
  const id = Number.parseInt(getRouterParam(event, 'id') || '', 10)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid maintenance ID' })
  return id
}
