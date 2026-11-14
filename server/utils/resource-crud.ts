import {fenceMonitorIds} from './monitor-mutation'
import type { H3Event } from 'h3'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireWorkspace, assertWorkspaceIds } from './workspace'
import { startMaintenanceJob, stopMaintenanceJob } from '../services/maintenance/scheduler'

const maintenanceSchema = z.object({
  title: z.string().min(1).max(200), description: z.string().max(10000).nullable().optional(),
  strategy: z.enum(['manual','single','recurring','recurring-interval','recurring-weekday','recurring-day-of-month','cron']).default('manual'),
  active: z.boolean().default(true), startDate: z.string().datetime().nullable().optional(), endDate: z.string().datetime().nullable().optional(),
  cron: z.string().max(200).nullable().optional(), duration: z.number().int().min(1).max(525600).default(60),
  timezone: z.string().max(100).default('UTC'), intervalDay: z.number().int().min(1).max(365).optional(),
  dateRange: z.string().max(10000).nullable().optional(), weekdays: z.string().max(1000).nullable().optional(),
  daysOfMonth: z.string().max(1000).nullable().optional(), timeRange: z.string().max(1000).nullable().optional(),
  monitorIds: z.array(z.number().int().positive()).max(4000).optional(), statusPageIds: z.array(z.number().int().positive()).max(4000).optional(),
})
export function maintenanceHandler(action: 'list'|'get'|'create'|'update'|'delete'|'pause'|'resume') {
  return defineEventHandler(async (event: H3Event) => {
    const scope = await requireWorkspace(event, ['list','get'].includes(action) ? 'viewer' : 'editor')
    const id = Number(getRouterParam(event, 'id'))
    if (action === 'list') return { ok: true, data: await prisma.maintenance.findMany({ where: { workspaceId: scope.workspaceId }, orderBy: { id: 'desc' }, take: 500 }) }
    const existing = action !== 'create' && Number.isSafeInteger(id)
      ? await prisma.maintenance.findFirst({ where: { id, workspaceId: scope.workspaceId }, include: { monitors: true, statusPages: true } }) : null
    if (action !== 'create' && !existing) throw createError({ statusCode: 404, message: 'Maintenance not found' })
    if (action === 'get') return { ok: true, data: existing }
    if (action === 'delete') {
      await prisma.$transaction(async tx=>{await fenceMonitorIds(tx,scope.workspaceId,(existing as any).monitors.map((row:any)=>row.monitorId));await tx.maintenance.delete({where:{id,workspaceId:scope.workspaceId}})}); stopMaintenanceJob(id)
      return { ok: true }
    }
    const body = ['pause','resume'].includes(action) ? { active: action === 'resume' } : await readBody(event)
    const parsed = (action === 'create' ? maintenanceSchema : maintenanceSchema.partial()).safeParse(body)
    if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message })
    const input = action === 'create' ? parsed.data : Object.fromEntries(Object.entries(parsed.data).filter(([key]) => Object.hasOwn(body, key))) as typeof parsed.data
    const { monitorIds, statusPageIds, startDate, endDate, ...fields } = input
    const result = await prisma.$transaction(async tx => {
      const monitors = monitorIds && await assertWorkspaceIds(tx, 'monitor', monitorIds, scope.workspaceId)
      const pages = statusPageIds && await assertWorkspaceIds(tx, 'statusPage', statusPageIds, scope.workspaceId)
      await fenceMonitorIds(tx,scope.workspaceId,[...(monitors||[]),...((existing as any)?.monitors||[]).map((row:any)=>row.monitorId)])
      const data = { ...fields, ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}) }
      const maintenance = action === 'create'
        ? await tx.maintenance.create({ data: { ...data, title: fields.title!, workspaceId: scope.workspaceId, userId: scope.user.id } })
        : await tx.maintenance.update({ where: { id, workspaceId: scope.workspaceId }, data })
      if (monitors) {
        await tx.maintenanceMonitor.deleteMany({ where: { maintenanceId: maintenance.id } })
        if (monitors.length) await tx.maintenanceMonitor.createMany({ data: monitors.map(monitorId => ({ maintenanceId: maintenance.id, monitorId })) })
      }
      if (pages) {
        await tx.maintenanceStatusPage.deleteMany({ where: { maintenanceId: maintenance.id } })
        if (pages.length) await tx.maintenanceStatusPage.createMany({ data: pages.map(statusPageId => ({ maintenanceId: maintenance.id, statusPageId })) })
      }
      return maintenance
    })
    if (result.active) await startMaintenanceJob(result); else stopMaintenanceJob(result.id)
    return { ok: true, data: result }
  })
}
