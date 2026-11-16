// server/services/variables/service.ts
// Variables monitors use as {{name}}: global ones, and per-workspace ones that
// override them. Secret values are write-only: the API never returns them.

import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { applyVariables, VARIABLE_NAME, variablesForWorkspace, type ScopedVariable } from './resolve'

export class VariableError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
  }
}

const nameSchema = z.string().trim().regex(VARIABLE_NAME, 'Invalid name: letters, digits, _ . - and not starting with a digit')
const valueSchema = z.string().max(10_000, 'Value is too long')
const scopeSchema = z.number().int().positive().nullable()

const createSchema = z.object({
  name: nameSchema,
  value: valueSchema.default(''),
  secret: z.boolean().default(false),
  workspaceId: scopeSchema.default(null),
})

const updateSchema = z.object({
  name: nameSchema.optional(),
  // Omitted = keep the current value (how a secret is left unchanged)
  value: valueSchema.optional(),
  secret: z.boolean().optional(),
})

const bulkSchema = z.object({
  workspaceId: scopeSchema.default(null),
  variables: z.array(z.object({ name: nameSchema, value: valueSchema, secret: z.boolean().default(false) })).max(500),
})

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body)
  if (!result.success) throw new VariableError(result.error.issues[0]?.message || 'Invalid input')
  return result.data
}

// ---------- Values for checks (cached briefly; cleared on every change) ----------
const CACHE_MS = 10_000
const cache = new Map<number, { at: number; vars: (ScopedVariable & { secret: boolean })[] }>()

export function invalidateVariables(userId: number) {
  cache.delete(userId)
}

async function scopedVariables(userId: number): Promise<(ScopedVariable & { secret: boolean })[]> {
  const hit = cache.get(userId)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.vars
  const vars = await prisma.variable.findMany({ where: { userId }, select: { name: true, value: true, workspaceId: true, secret: true } })
  cache.set(userId, { at: Date.now(), vars })
  return vars
}

/**
 * Effective variables for a monitor of `userId` in `workspaceId`, plus the
 * secret values in effect so messages can be masked
 */
export async function variablesForMonitor(userId: number, workspaceId: number | null) {
  const all = await scopedVariables(userId)
  const vars = variablesForWorkspace(all, workspaceId)
  const secretNames = new Set(all.filter(v => v.secret && (v.workspaceId == null || v.workspaceId === workspaceId)).map(v => v.name))
  const secrets = [...secretNames].map(name => vars[name]).filter((v): v is string => !!v)
  return { vars, secrets }
}

/** A monitor's URL with its variables filled in; null when it has none or one is unknown */
export async function resolveMonitorUrl(monitor: { url?: string | null; userId: number; workspaceId?: number | null }): Promise<string | null> {
  if (!monitor.url) return null
  if (!monitor.url.includes('{{')) return monitor.url
  try {
    const { vars } = await variablesForMonitor(monitor.userId, monitor.workspaceId ?? null)
    const filled = applyVariables({ url: monitor.url }, vars)
    return filled.missing.length ? null : filled.monitor.url
  } catch {
    return null
  }
}

// ---------- CRUD ----------
type Row = { id: number; name: string; value: string; secret: boolean; workspaceId: number | null; createdAt: Date }

function present(row: Row) {
  return {
    id: row.id,
    name: row.name,
    secret: row.secret,
    workspaceId: row.workspaceId,
    value: row.secret ? '' : row.value,
    hasValue: row.value !== '',
    createdAt: row.createdAt,
  }
}

async function assertWorkspace(userId: number, workspaceId: number | null) {
  if (workspaceId == null) return
  const found = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } })
  if (!found) throw new VariableError('Workspace not found', 404)
}

async function assertUnique(userId: number, workspaceId: number | null, name: string, exceptId?: number) {
  const clash = await prisma.variable.findFirst({ where: { userId, workspaceId, name, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } })
  if (clash) throw new VariableError(`"${name}" already exists in this scope`, 409)
}

async function findOwn(userId: number, id: number) {
  const row = await prisma.variable.findFirst({ where: { id, userId } })
  if (!row) throw new VariableError('Variable not found', 404)
  return row
}

export async function listVariables(userId: number) {
  const rows = await prisma.variable.findMany({ where: { userId }, orderBy: [{ workspaceId: 'asc' }, { name: 'asc' }] })
  return rows.map(present)
}

export async function createVariable(userId: number, body: unknown) {
  const input = parse(createSchema, body)
  await assertWorkspace(userId, input.workspaceId)
  await assertUnique(userId, input.workspaceId, input.name)
  const row = await prisma.variable.create({ data: { ...input, userId } })
  invalidateVariables(userId)
  return present(row)
}

export async function updateVariable(userId: number, id: number, body: unknown) {
  const input = parse(updateSchema, body)
  const current = await findOwn(userId, id)
  if (input.name && input.name !== current.name) await assertUnique(userId, current.workspaceId, input.name, id)
  // Un-marking a secret must not reveal it: without a new value it is cleared
  const data = { ...input }
  if (current.secret && input.secret === false && input.value === undefined) data.value = ''
  const row = await prisma.variable.update({ where: { id }, data })
  invalidateVariables(userId)
  return present(row)
}

export async function deleteVariable(userId: number, id: number) {
  await findOwn(userId, id)
  await prisma.variable.delete({ where: { id } })
  invalidateVariables(userId)
}

/** Create or update several variables of one scope by name (used by imports) */
export async function saveVariables(userId: number, body: unknown) {
  const input = parse(bulkSchema, body)
  await assertWorkspace(userId, input.workspaceId)
  let created = 0
  let updated = 0
  for (const v of input.variables) {
    const existing = await prisma.variable.findFirst({ where: { userId, workspaceId: input.workspaceId, name: v.name } })
    if (existing) {
      // An empty value never wipes a stored one (e.g. a secret the file did not contain)
      await prisma.variable.update({ where: { id: existing.id }, data: { secret: existing.secret || v.secret, ...(v.value !== '' ? { value: v.value } : {}) } })
      updated++
    } else {
      await prisma.variable.create({ data: { ...v, workspaceId: input.workspaceId, userId } })
      created++
    }
  }
  invalidateVariables(userId)
  return { created, updated }
}

// ---------- HTTP helpers ----------
export async function handleVariableRequest<T>(
  event: Parameters<typeof getUserSession>[0],
  fn: (userId: number) => Promise<T>,
): Promise<T> {
  const session = await getUserSession(event)
  const userId = Number((session?.user as { id?: number } | undefined)?.id)
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })
  try {
    return await fn(userId)
  } catch (error) {
    if (error instanceof VariableError) throw createError({ statusCode: error.statusCode, message: error.message })
    throw error
  }
}

export function getVariableId(event: Parameters<typeof getRouterParam>[0]): number {
  const id = Number.parseInt(getRouterParam(event, 'id') || '', 10)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid ID' })
  return id
}
