import {databaseNow,initialMonitorSchedule} from './monitor-mutation'
import { reserveMonitorId, monitorDbInput } from './monitor-secrets'
import { z } from 'zod'
import { prisma } from './prisma'
import { requireWorkspace } from './workspace'
import { createMonitorSchema } from './monitor-input'
import { stopMonitorJob } from '../services/monitor/scheduler'

function safeURL(value: string | null) {
  if (!value) return value
  try { const url = new URL(value); url.username = ''; url.password = ''; for (const key of url.searchParams.keys()) url.searchParams.set(key, '{{redacted}}'); return url.toString() }
  catch { return value.includes('{{') ? value : '' }
}
export const exportBackup = defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner'), where = { workspaceId: scope.workspaceId }
  const [monitors, tags, notifications, proxies, dockerHosts, statusPages, maintenances] = await Promise.all([
    prisma.monitor.findMany({ where: { ...where, environmentId: scope.environmentId }, include: { tags: true, monitorNotifications: true }, take: 4000 }),
    prisma.tag.findMany({ where, take: 500 }), prisma.notification.findMany({ where, take: 500 }),
    prisma.proxy.findMany({ where, take: 200 }), prisma.dockerHost.findMany({ where, take: 200 }),
    prisma.statusPage.findMany({ where, include: { groups: { include: { monitors: true } } }, take: 100 }),
    prisma.maintenance.findMany({ where, include: { monitors: true, statusPages: true }, take: 500 }),
  ])
  return { version: '1.1', exportedAt: new Date().toISOString(), redacted: true,
    notice: 'Secrets, headers, bodies and URL query values are omitted. Restores create paused monitors; configure secrets before activation.', data: {
      monitors: monitors.map(m => ({ id: m.id, name: m.name, type: m.type, description: m.description, url: safeURL(m.url), hostname: m.hostname,
        port: m.port, interval: m.interval, timeout: m.timeout, retryInterval: m.retryInterval, maxretries: m.maxretries, method: m.method,
        assertions: m.assertions, jsonPath: m.jsonPath, expectedValue: m.expectedValue, keyword: m.keyword, acceptedStatuscodes: m.acceptedStatuscodes, active: false, ignoreTls: m.ignoreTls, upsideDown: m.upsideDown, tagIds: m.tags.map(x => x.tagId), notificationIds: m.monitorNotifications.map(x => x.notificationId) })),
      tags: tags.map(t => ({ id: t.id, name: t.name, color: t.color })),
      notifications: notifications.map(n => ({ id: n.id, name: n.name, type: n.type, active: false, isDefault: n.isDefault, config: {} })),
      proxies: proxies.map(p => ({ id: p.id, protocol: p.protocol, host: '', port: p.port, active: false, auth: false })),
      dockerHosts: dockerHosts.map(d => ({ id: d.id, name: d.name, dockerType: d.dockerType, active: false })),
      statusPages: statusPages.map(s => ({ id: s.id, slug: s.slug, title: s.title, description: s.description, published: false,
        groups: s.groups.map(g => ({ name: g.name, weight: g.weight, monitorIds: g.monitors.map(m => m.monitorId) })) })),
      maintenances: maintenances.map(m => ({ id: m.id, title: m.title, description: m.description, strategy: m.strategy, active: false,
        monitorIds: m.monitors.map(x => x.monitorId), statusPageIds: m.statusPages.map(x => x.statusPageId) })),
    } }
})
const objects = (limit: number) => z.array(z.record(z.string(), z.unknown())).max(limit).optional()
const schema = z.object({ data: z.object({ version: z.string().optional(), data: z.object({ monitors: objects(4000), tags: objects(500),
  notifications: objects(500), proxies: objects(200), dockerHosts: objects(200), statusPages: objects(100), maintenances: objects(500) }) }),
  options: z.object({ overwrite: z.boolean().default(false), importMonitors: z.boolean().default(true), importNotifications: z.boolean().default(true),
    importProxies: z.boolean().default(true), importDockerHosts: z.boolean().default(true), importStatusPages: z.boolean().default(true), importMaintenances: z.boolean().default(true) }).prefault({}) })
const text = (x: unknown, fallback = '') => typeof x === 'string' ? x.slice(0, 10000) : fallback
export const importBackup = defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner')
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message })
  const { data: { data }, options } = parsed.data
  if (options.overwrite) throw createError({ statusCode: 409, message: 'Restore creates new paused resources. Overwrite is not supported; use individual edits.' })
  const results: Record<string, { imported: number; skipped: number }> = {}
  const monitorIds: number[] = []
  await prisma.$transaction(async tx => {
    const maps: Record<string, Map<unknown, number>> = Object.fromEntries(['tags','notifications','proxies','dockerHosts','monitors','statusPages'].map(key => [key, new Map()]))
    const create = async (kind: keyof typeof data, model: string, records: any[] | undefined, fields: (row: any) => any) => {
      results[kind] = { imported: 0, skipped: 0 }
      for (const row of records || []) {
        const resource = await (tx as any)[model].create({ data: { ...fields(row), userId: scope.user.id, workspaceId: scope.workspaceId } })
        maps[kind]?.set(row.id, resource.id); results[kind]!.imported++
      }
    }
    await create('tags','tag',data.tags, r => ({ name: text(r.name), color: text(r.color, '#999999') }))
    if (options.importNotifications) await create('notifications','notification',data.notifications, r => ({ name: text(r.name), type: text(r.type), config: {}, active: false }))
    if (options.importProxies) await create('proxies','proxy',data.proxies, r => ({ protocol: text(r.protocol, 'http'), host: '', port: Number(r.port) || 80, active: false }))
    if (options.importDockerHosts) await create('dockerHosts','dockerHost',data.dockerHosts, r => ({ name: text(r.name), dockerType: text(r.dockerType, 'tcp'), active: false }))
    const mapped = (kind: string, ids: unknown) => {
      if (ids === undefined) return []
      if (!Array.isArray(ids) || ids.length > 4000) throw createError({ statusCode: 400, message: 'Invalid backup relation IDs' })
      return [...new Set(ids.map(id => { const mapped = maps[kind]?.get(id); if (!mapped) throw createError({ statusCode: 400, message: 'Backup refers to an unimported resource' }); return mapped }))]
    }
    if (options.importMonitors) {
      results.monitors = { imported: 0, skipped: 0 }
      for (const row of data.monitors || []) {
        const input = createMonitorSchema.safeParse({ ...row, active: false, tags: undefined, notifications: undefined, proxyId: undefined, parent: undefined, remoteBrowserId: undefined })
        if (!input.success) throw createError({ statusCode: 400, message: 'Invalid monitor configuration in backup' })
        const { tags, notifications, clearSecrets, ...fields } = input.data
        const id=await reserveMonitorId(tx)
        const record:any={...fields,...initialMonitorSchedule(id,fields.interval,await databaseNow(tx)),id,workspaceId:scope.workspaceId,environmentId:scope.environmentId,userId:scope.user.id}
        for(const key of ['assertions','acceptedStatuscodes','tlsExpiryDays'])if(record[key]===null)delete record[key]
        const monitor=await tx.monitor.create({data:monitorDbInput(record)})
        maps.monitors!.set(row.id, monitor.id); monitorIds.push(monitor.id)
        for (const tagId of mapped('tags', row.tagIds)) await tx.monitorTag.create({ data: { monitorId: monitor.id, tagId } })
        for (const notificationId of mapped('notifications', row.notificationIds)) await tx.monitorNotification.create({ data: { monitorId: monitor.id, notificationId } })
        results.monitors.imported++
      }
    }
    if (options.importStatusPages) {
      results.statusPages = { imported: 0, skipped: 0 }
      for (const row of data.statusPages || []) {
        const slug = text(row.slug)
        if (!/^[a-z0-9-]{1,100}$/.test(slug)) throw createError({ statusCode: 400, message: 'Invalid status page slug' })
        const page = await tx.statusPage.create({ data: { slug: `${slug}-restored-${Date.now()}-${results.statusPages.imported}`, title: text(row.title), description: text(row.description), published: false, workspaceId: scope.workspaceId, userId: scope.user.id } })
        maps.statusPages!.set(row.id, page.id)
        if (Array.isArray(row.groups)) for (const group of row.groups.slice(0, 100) as any[]) {
          const saved = await tx.statusPageGroup.create({ data: { statusPageId: page.id, name: text(group.name), weight: Number(group.weight) || 1 } })
          for (const monitorId of mapped('monitors', group.monitorIds)) await tx.statusPageMonitor.create({ data: { groupId: saved.id, monitorId } })
        }
        results.statusPages.imported++
      }
    }
    if (options.importMaintenances) await create('maintenances','maintenance',data.maintenances, r => ({ title: text(r.title), description: text(r.description), strategy: 'manual', active: false }))
  }, { timeout: 120000, maxWait: 10000 })
  monitorIds.forEach(stopMonitorJob)
  return { ok: true, results, notice: 'Resources restored paused. Reconfigure omitted credentials before activation.' }
})
