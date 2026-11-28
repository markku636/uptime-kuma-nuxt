// Monitoring as code：可版本化的宣告式 subset（檢查定義，不含 secret）。
// 聚焦 HTTP／browser-flow／site-audit／visual-diff 等可安全描述的欄位。
import { z } from 'zod'
import { createMonitorSchema } from '../utils/monitor-input'
import { reserveMonitorId } from '../utils/monitor-secrets'
import { initialMonitorSchedule, databaseNow } from '../utils/monitor-mutation'

export const DECLARATIVE_VERSION = '1.0'
const EXPORT_LIMIT = 500

const declarativeMonitorSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  url: z.string().max(8192).optional(),
  hostname: z.string().max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  interval: z.number().int().min(10).max(86400).optional(),
  timeout: z.number().int().min(1).max(120).optional(),
  method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']).optional(),
  keyword: z.string().max(2000).optional(),
  jsonPath: z.string().max(512).optional(),
  expectedValue: z.string().max(2000).optional(),
  ignoreTls: z.boolean().optional(),
  upsideDown: z.boolean().optional(),
  maxRedirects: z.number().int().min(0).max(10).optional(),
  active: z.boolean().optional(),
  body: z.string().max(1048576).optional(),
  assertions: z.unknown().optional(),
  visualConfig: z.unknown().optional(),
}).strict()

export const declarativeDocumentSchema = z.object({
  version: z.literal(DECLARATIVE_VERSION),
  monitors: z.array(declarativeMonitorSchema).max(EXPORT_LIMIT),
}).strict()

export type DeclarativeDocument = z.infer<typeof declarativeDocumentSchema>
export type DeclarativeMonitor = DeclarativeDocument['monitors'][number]

export interface PlanAction {
  action: 'create' | 'update' | 'nochange'
  name: string
  changes: string[]
}

function safeURL(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    for (const key of url.searchParams.keys()) url.searchParams.set(key, '{{redacted}}')
    return url.toString()
  } catch { return undefined }
}

/** body 只對宣告式流程型別匯出；一般 HTTP body 可能含 secret，一律省略。 */
const BODY_TYPES = new Set(['browser-flow', 'site-audit'])

export async function exportDeclarative(scope: { workspaceId: number; environmentId: number }, db: any): Promise<DeclarativeDocument> {
  const rows = await db.monitor.findMany({
    where: { workspaceId: scope.workspaceId, environmentId: scope.environmentId },
    orderBy: { id: 'asc' }, take: EXPORT_LIMIT,
    select: {
      name: true, type: true, url: true, hostname: true, port: true, interval: true, timeout: true,
      method: true, keyword: true, jsonPath: true, expectedValue: true, ignoreTls: true, upsideDown: true,
      maxRedirects: true, active: true, body: true, assertions: true, visualConfig: true,
    },
  })
  return {
    version: DECLARATIVE_VERSION,
    monitors: rows.map((row: any) => {
      const doc: Record<string, unknown> = {
        name: row.name, type: row.type, interval: row.interval, timeout: row.timeout, active: row.active,
      }
      const optional: Record<string, unknown> = {
        url: safeURL(row.url), hostname: row.hostname, port: row.port, method: row.method,
        keyword: row.keyword, jsonPath: row.jsonPath, expectedValue: row.expectedValue,
        ignoreTls: row.ignoreTls, upsideDown: row.upsideDown, maxRedirects: row.maxRedirects,
      }
      for (const [key, value] of Object.entries(optional)) if (value !== undefined && value !== null && value !== false && value !== 0) doc[key] = value
      if (BODY_TYPES.has(row.type) && typeof row.body === 'string') doc.body = row.body
      if (row.assertions) doc.assertions = row.assertions
      if (row.visualConfig) doc.visualConfig = row.visualConfig
      return doc as DeclarativeMonitor
    }),
  }
}

export interface ApplyResult { created: string[]; updated: string[]; unchanged: string[] }

/** 只建立／更新目前 workspace/environment 內的 monitor；预设新建为 paused。 */
export async function applyDeclarative(
  scope: { workspaceId: number; environmentId: number; user: { id: number } },
  desired: DeclarativeDocument,
  options: { activate?: boolean } = {},
  db: any,
): Promise<ApplyResult> {
  const result: ApplyResult = { created: [], updated: [], unchanged: [] }
  const names = desired.monitors.map(monitor => monitor.name)
  if (new Set(names).size !== names.length) throw new Error('Duplicate monitor names in document')
  await db.$transaction(async (tx: any) => {
    const existingRows = await tx.monitor.findMany({
      where: { workspaceId: scope.workspaceId, environmentId: scope.environmentId, name: { in: names } },
      select: { id: true, name: true },
    })
    const byName = new Map(existingRows.map((row: any) => [row.name, row.id]))
    for (const monitor of desired.monitors) {
      if (!BODY_TYPES.has(monitor.type) && monitor.body !== undefined) throw new Error(`body is not declarative for ${monitor.type}`)
      const id = byName.get(monitor.name)
      if (!id) {
        const parsed = createMonitorSchema.safeParse({ ...monitor, active: options.activate === true && monitor.active !== false })
        if (!parsed.success) throw new Error(`Invalid monitor ${monitor.name}: ${parsed.error.issues[0]?.message}`)
        const { tags: _tags, notifications: _notifications, clearSecrets: _clear, ...fields } = parsed.data as any
        const nextId = await reserveMonitorId(tx)
        await tx.monitor.create({ data: {
          ...fields, id: nextId, workspaceId: scope.workspaceId, environmentId: scope.environmentId,
          userId: scope.user.id, ...initialMonitorSchedule(nextId, fields.interval, await databaseNow(tx)),
        } })
        result.created.push(monitor.name)
      } else {
        const parsed = createMonitorSchema.partial().safeParse(monitor)
        if (!parsed.success) throw new Error(`Invalid monitor ${monitor.name}: ${parsed.error.issues[0]?.message}`)
        const updates: any = { ...parsed.data }
        if (options.activate !== true) delete updates.active
        else if (monitor.active === false) updates.active = false
        const keys = Object.keys(updates)
        if (keys.length) { await tx.monitor.update({ where: { id }, data: updates }); result.updated.push(monitor.name) }
        else result.unchanged.push(monitor.name)
      }
    }
  }, { timeout: 15_000, maxWait: 5_000 })
  return result
}

export function planDeclarative(current: DeclarativeDocument, desired: DeclarativeDocument): PlanAction[] {
  const byName = new Map(current.monitors.map(monitor => [monitor.name, monitor]))
  const seen = new Set<string>()
  return desired.monitors.map(monitor => {
    seen.add(monitor.name)
    const existing = byName.get(monitor.name)
    if (!existing) return { action: 'create' as const, name: monitor.name, changes: ['*new*'] }
    const changes = [...new Set([...Object.keys(existing), ...Object.keys(monitor)])]
      .filter(key => JSON.stringify((existing as any)[key]) !== JSON.stringify((monitor as any)[key]))
      .sort()
    return { action: changes.length ? 'update' as const : 'nochange' as const, name: monitor.name, changes }
  })
}
