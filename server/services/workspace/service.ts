// server/services/workspace/service.ts
// CRUD for workspaces and monitor groups, plus the rules that keep the
// Workspace -> Group -> Monitor hierarchy consistent:
//   - a group is a monitor with type "group"; members reference it via `parent`
//   - a member always lives in the same workspace as its group
//   - deleting a workspace or a group never deletes the monitors inside it

import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { scheduleGroupRecheck, startMonitorJob, stopMonitorJob } from '../monitor/scheduler'
import { broadcastMonitorDeleted } from '../socket'
import { descendantIds, wouldCreateCycle, type TreeNode } from './tree'

export class WorkspaceError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
  }
}

const nameSchema = z.string().trim().min(1, 'Name is required').max(100, 'Name is too long')
const descriptionSchema = z.string().trim().max(500, 'Description is too long').nullish()
const idOrNull = z.number().int().positive().nullable()

const workspaceInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color (must be #RRGGBB)').optional(),
})

const groupInputSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  workspaceId: idOrNull.optional(),
  // Parent group (nesting). A nested group always lives in its parent's workspace.
  parent: idOrNull.optional(),
})

const organizeInputSchema = z
  .object({
    monitorIds: z.array(z.number().int().positive()).min(1, 'Select at least one monitor').max(1000),
    // number: move into that group, null: remove from its group, omitted: keep
    parent: idOrNull.optional(),
    // number: move into that workspace, null: unassign, omitted: keep
    workspaceId: idOrNull.optional(),
  })
  .refine(data => data.parent !== undefined || data.workspaceId !== undefined, 'Nothing to change')

function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    throw new WorkspaceError(result.error.issues[0]?.message || 'Invalid input')
  }
  return result.data
}

// ---------- Shared lookups ----------

async function assertWorkspace(userId: number, workspaceId: number | null | undefined) {
  if (workspaceId == null) return
  const found = await prisma.workspace.findFirst({ where: { id: workspaceId, userId }, select: { id: true } })
  if (!found) throw new WorkspaceError('Workspace not found', 404)
}

async function findGroup(userId: number, groupId: number) {
  const group = await prisma.monitor.findFirst({
    where: { id: groupId, userId, type: 'group' },
    select: { id: true, parent: true, workspaceId: true },
  })
  if (!group) throw new WorkspaceError('Group not found', 404)
  return group
}

function loadTree(userId: number): Promise<TreeNode[]> {
  return prisma.monitor.findMany({ where: { userId }, select: { id: true, parent: true } })
}

/** Put everything below the given monitors into the same workspace as them */
async function syncSubtreeWorkspace(userId: number, rootIds: number[], workspaceId: number | null) {
  const tree = await loadTree(userId)
  const ids = [...new Set(rootIds.flatMap(id => descendantIds(tree, id)))]
  if (ids.length) {
    await prisma.monitor.updateMany({ where: { id: { in: ids }, userId }, data: { workspaceId } })
  }
}

// ---------- Workspaces ----------

export async function listWorkspaces(userId: number) {
  const [workspaces, counts] = await Promise.all([
    prisma.workspace.findMany({ where: { userId }, orderBy: [{ weight: 'asc' }, { id: 'asc' }] }),
    prisma.monitor.groupBy({ by: ['workspaceId', 'type'], where: { userId }, _count: { _all: true } }),
  ])

  const count = (workspaceId: number | null, groups: boolean) =>
    counts
      .filter(c => c.workspaceId === workspaceId && (c.type === 'group') === groups)
      .reduce((sum, c) => sum + c._count._all, 0)

  return {
    workspaces: workspaces.map(w => ({
      ...w,
      monitorCount: count(w.id, false),
      groupCount: count(w.id, true),
    })),
    unassigned: { monitorCount: count(null, false), groupCount: count(null, true) },
  }
}

export async function createWorkspace(userId: number, body: unknown) {
  const input = parse(workspaceInputSchema, body)
  const last = await prisma.workspace.findFirst({ where: { userId }, orderBy: { weight: 'desc' }, select: { weight: true } })
  const workspace = await prisma.workspace.create({
    data: {
      name: input.name,
      description: input.description || null,
      color: input.color,
      weight: (last?.weight ?? 0) + 1000,
      userId,
    },
  })
  return { ...workspace, monitorCount: 0, groupCount: 0 }
}

export async function updateWorkspace(userId: number, id: number, body: unknown) {
  const input = parse(workspaceInputSchema, body)
  await assertWorkspace(userId, id)
  return prisma.workspace.update({
    where: { id },
    data: { name: input.name, description: input.description || null, color: input.color },
  })
}

const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'Nothing to reorder').max(1000),
})

/** Set the display order of workspaces: `ids` from first to last */
export async function reorderWorkspaces(userId: number, body: unknown) {
  const ids = [...new Set(parse(reorderSchema, body).ids)]
  const owned = await prisma.workspace.count({ where: { id: { in: ids }, userId } })
  if (owned !== ids.length) throw new WorkspaceError('Workspace not found', 404)
  await prisma.$transaction(ids.map((id, index) =>
    prisma.workspace.update({ where: { id }, data: { weight: (index + 1) * 1000 } }),
  ))
  return { reordered: ids.length }
}

/** Monitors and groups inside the workspace are kept and become unassigned */
export async function deleteWorkspace(userId: number, id: number) {
  await assertWorkspace(userId, id)
  await prisma.workspace.delete({ where: { id } })
}

// ---------- Groups ----------

const groupSelect = {
  id: true,
  name: true,
  description: true,
  active: true,
  parent: true,
  workspaceId: true,
  weight: true,
} as const

export async function listGroups(userId: number) {
  const [groups, members] = await Promise.all([
    prisma.monitor.findMany({
      where: { userId, type: 'group' },
      select: groupSelect,
      orderBy: [{ weight: 'asc' }, { name: 'asc' }],
    }),
    prisma.monitor.groupBy({ by: ['parent'], where: { userId, parent: { not: null } }, _count: { _all: true } }),
  ])
  const memberCount = new Map(members.map(m => [m.parent, m._count._all]))
  return groups.map(g => ({ ...g, monitorCount: memberCount.get(g.id) ?? 0 }))
}

export async function createGroup(userId: number, body: unknown) {
  const input = parse(groupInputSchema, body)
  const placement = await resolvePlacement(userId, null, { parent: input.parent, workspaceId: input.workspaceId })

  const group = await prisma.monitor.create({
    data: {
      name: input.name,
      description: input.description || null,
      type: 'group',
      active: true,
      ...placement,
      userId,
    },
  })
  startMonitorJob(group)
  scheduleGroupRecheck(placement.parent)
  return { ...pick(group), monitorCount: 0 }
}

export async function updateGroup(userId: number, id: number, body: unknown) {
  const input = parse(groupInputSchema, body)
  const existing = await findGroup(userId, id)
  const current = { parent: existing.parent, workspaceId: existing.workspaceId }

  // Moving a nested group to another workspace (without naming a new parent) detaches it
  let parentInput = input.parent
  if (parentInput === undefined && input.workspaceId !== undefined && input.workspaceId !== existing.workspaceId) {
    parentInput = null
  }
  const placement = await resolvePlacement(userId, id, { parent: parentInput, workspaceId: input.workspaceId }, current)

  const group = await prisma.monitor.update({
    where: { id },
    data: { name: input.name, description: input.description || null, ...placement },
  })
  if (placement.workspaceId !== existing.workspaceId) await syncSubtreeWorkspace(userId, [id], placement.workspaceId)
  if (placement.parent !== existing.parent) scheduleGroupRecheck([existing.parent, placement.parent])

  // The scheduler keeps a copy of the monitor, restart so the new name is used
  startMonitorJob(group)

  const monitorCount = await prisma.monitor.count({ where: { userId, parent: id } })
  return { ...pick(group), monitorCount }
}

/** Pause or resume a group together with everything inside it (subgroups included) */
export async function setGroupActive(userId: number, id: number, active: boolean) {
  const group = await findGroup(userId, id)
  const ids = [id, ...descendantIds(await loadTree(userId), id)]
  await prisma.monitor.updateMany({ where: { id: { in: ids }, userId }, data: { active } })

  const monitors = await prisma.monitor.findMany({ where: { id: { in: ids }, userId } })
  for (const monitor of monitors) {
    if (active) startMonitorJob(monitor)
    else stopMonitorJob(monitor.id)
  }
  // The group above (if any) counts this one differently now
  scheduleGroupRecheck(group.parent)
  return { updated: ids.length }
}

/** Members are kept: they move up to the deleted group's own parent (or become ungrouped) */
export async function deleteGroup(userId: number, id: number) {
  const group = await findGroup(userId, id)
  stopMonitorJob(id)
  await prisma.$transaction([
    prisma.monitor.updateMany({ where: { userId, parent: id }, data: { parent: group.parent } }),
    prisma.monitor.delete({ where: { id } }),
  ])
  broadcastMonitorDeleted(userId, id)
  // Its members now count for the group above it
  scheduleGroupRecheck(group.parent)
}

/** Detach the children of a monitor that is about to be deleted through the monitors API */
export async function releaseChildren(userId: number, monitorId: number, newParent: number | null) {
  await prisma.monitor.updateMany({ where: { userId, parent: monitorId }, data: { parent: newParent } })
}

function pick(monitor: { id: number; name: string; description: string | null; active: boolean; parent: number | null; workspaceId: number | null; weight: number }) {
  const { id, name, description, active, parent, workspaceId, weight } = monitor
  return { id, name, description, active, parent, workspaceId, weight }
}

// ---------- Placement of monitors ----------

export interface Placement {
  parent: number | null
  workspaceId: number | null
}

/**
 * Validate where a monitor is about to be placed and return the values to store.
 * Inside a group the workspace is always the group's workspace.
 */
export async function resolvePlacement(
  userId: number,
  monitorId: number | null,
  input: { parent?: number | null; workspaceId?: number | null },
  current: Placement = { parent: null, workspaceId: null },
): Promise<Placement> {
  const parent = input.parent === undefined ? current.parent : input.parent

  if (parent != null) {
    // Keep an untouched (possibly legacy) parent as is; only validate real changes
    if (parent !== current.parent || input.workspaceId !== undefined) {
      const group = await findGroup(userId, parent)
      if (monitorId != null && wouldCreateCycle(await loadTree(userId), monitorId, parent)) {
        throw new WorkspaceError('A group cannot be placed inside itself')
      }
      return { parent, workspaceId: group.workspaceId }
    }
    return { parent, workspaceId: current.workspaceId }
  }

  const workspaceId = input.workspaceId === undefined ? current.workspaceId : input.workspaceId
  if (workspaceId !== current.workspaceId) await assertWorkspace(userId, workspaceId)
  return { parent: null, workspaceId }
}

/** After a monitor changed workspace: if it is a group, its members follow */
export async function syncMembersAfterMove(userId: number, monitor: { id: number; type: string; workspaceId: number | null }) {
  if (monitor.type === 'group') await syncSubtreeWorkspace(userId, [monitor.id], monitor.workspaceId)
}

/** Move several monitors (or groups) into a group and / or a workspace at once */
export async function organizeMonitors(userId: number, body: unknown) {
  const input = parse(organizeInputSchema, body)
  const ids = [...new Set(input.monitorIds)]

  const monitors = await prisma.monitor.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, parent: true, workspaceId: true },
  })
  if (monitors.length !== ids.length) throw new WorkspaceError('Monitor not found', 404)

  let data: Partial<Placement>

  if (input.parent != null) {
    const group = await findGroup(userId, input.parent)
    const tree = await loadTree(userId)
    if (ids.some(id => wouldCreateCycle(tree, id, group.id))) {
      throw new WorkspaceError('A group cannot be placed inside itself')
    }
    data = { parent: group.id, workspaceId: group.workspaceId }
  } else if (input.parent === null) {
    await assertWorkspace(userId, input.workspaceId)
    data = input.workspaceId === undefined ? { parent: null } : { parent: null, workspaceId: input.workspaceId }
  } else {
    // Workspace only: leaving the workspace of the current group also leaves the group
    await assertWorkspace(userId, input.workspaceId)
    const workspaceId = input.workspaceId ?? null
    const parentIds = [...new Set(monitors.map(m => m.parent).filter((p): p is number => p != null))]
    const parents = await prisma.monitor.findMany({ where: { id: { in: parentIds }, userId }, select: { id: true, workspaceId: true } })
    const parentWorkspace = new Map(parents.map(p => [p.id, p.workspaceId]))
    const detach = monitors.filter(m => m.parent != null && parentWorkspace.get(m.parent) !== workspaceId).map(m => m.id)

    await prisma.$transaction([
      prisma.monitor.updateMany({ where: { id: { in: ids }, userId }, data: { workspaceId } }),
      prisma.monitor.updateMany({ where: { id: { in: detach }, userId }, data: { parent: null } }),
    ])
    await syncSubtreeWorkspace(userId, ids, workspaceId)
    scheduleGroupRecheck(monitors.filter(m => detach.includes(m.id)).map(m => m.parent))
    return { updated: ids.length }
  }

  await prisma.monitor.updateMany({ where: { id: { in: ids }, userId }, data })
  if (data.workspaceId !== undefined) await syncSubtreeWorkspace(userId, ids, data.workspaceId)
  scheduleGroupRecheck([...monitors.map(m => m.parent), data.parent])
  return { updated: ids.length }
}

// ---------- HTTP helpers ----------

export async function handleWorkspaceRequest<T>(
  event: Parameters<typeof getUserSession>[0],
  fn: (userId: number) => Promise<T>,
): Promise<T> {
  const session = await getUserSession(event)
  const userId = Number((session?.user as { id?: number } | undefined)?.id)
  if (!userId) throw createError({ statusCode: 401, message: 'Unauthorized' })
  try {
    return await fn(userId)
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw createError({ statusCode: error.statusCode, message: error.message })
    }
    throw error
  }
}

export function getIdParam(event: Parameters<typeof getRouterParam>[0]): number {
  const id = Number.parseInt(getRouterParam(event, 'id') || '', 10)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, message: 'Invalid ID' })
  return id
}
