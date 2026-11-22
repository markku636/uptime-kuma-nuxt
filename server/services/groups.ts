import {Prisma} from '@prisma/client'
import type {BrunoManifest,BrunoParsed} from '../../shared/types/bruno'
import {prisma} from '../utils/prisma'

/**
 * Monitor groups belong to a workspace (not an environment) so one Bruno collection
 * can be imported into dev/staging/prod and share a single tree.
 * Bruno identity: (workspace, collection_id, source_path) where '' is the collection root.
 */
export const MAX_GROUP_DEPTH = 8
export const MAX_GROUPS_PER_WORKSPACE = 2000

export interface GroupRow {id: number; parentId: number | null; name: string; sortOrder: number; sourceKind: string; collectionId: string | null; sourcePath: string | null}

export function cleanGroupName(value: unknown) {
  if (typeof value !== 'string') throw createError({statusCode: 400, message: 'Group name is required'})
  const name = value.replace(/\s+/g, ' ').trim()
  if (!name || name.length > 150) throw createError({statusCode: 400, message: 'Group name must be 1–150 characters'})
  return name
}

export async function findGroup(db: any, workspaceId: number, id: unknown): Promise<GroupRow> {
  const group = Number.isSafeInteger(id) && (id as number) > 0 ? await db.monitorGroup.findFirst({where: {id, workspaceId}}) : null
  if (!group) throw createError({statusCode: 404, message: 'Group not found'})
  return group
}

/** Ids of the group and every group below it. */
export async function subtreeIds(db: any, workspaceId: number, id: number): Promise<number[]> {
  const rows = await db.$queryRaw<{id: number}[]>`
    WITH RECURSIVE tree AS (
      SELECT id FROM monitor_groups WHERE id=${id} AND workspace_id=${workspaceId}
      UNION ALL SELECT g.id FROM monitor_groups g JOIN tree t ON g.parent_id=t.id WHERE g.workspace_id=${workspaceId}
    ) SELECT id FROM tree`
  return rows.map((row: { id: number }) => row.id)
}

async function depthOf(db: any, workspaceId: number, id: number | null): Promise<number> {
  if (id === null) return 0
  const [row] = await db.$queryRaw<{depth: number}[]>`
    WITH RECURSIVE up AS (
      SELECT id,parent_id,1 AS depth FROM monitor_groups WHERE id=${id} AND workspace_id=${workspaceId}
      UNION ALL SELECT g.id,g.parent_id,u.depth+1 FROM monitor_groups g JOIN up u ON g.id=u.parent_id WHERE u.depth<${MAX_GROUP_DEPTH + 1}
    ) SELECT max(depth)::int AS depth FROM up`
  return row?.depth ?? 0
}

/** Moving a group under itself or a descendant would detach a cycle from the tree. */
export async function assertValidParent(db: any, workspaceId: number, groupId: number | null, parentId: number | null) {
  if (parentId === null) return
  await findGroup(db, workspaceId, parentId)
  if (groupId !== null && (await subtreeIds(db, workspaceId, groupId)).includes(parentId)) {
    throw createError({statusCode: 400, message: 'A group cannot be moved into itself or one of its subgroups'})
  }
  const subtreeDepth = groupId === null ? 1 : await subtreeHeight(db, workspaceId, groupId)
  if (await depthOf(db, workspaceId, parentId) + subtreeDepth > MAX_GROUP_DEPTH) {
    throw createError({statusCode: 400, message: `Groups can be nested at most ${MAX_GROUP_DEPTH} levels deep`})
  }
}

async function subtreeHeight(db: any, workspaceId: number, id: number): Promise<number> {
  const [row] = await db.$queryRaw<{height: number}[]>`
    WITH RECURSIVE tree AS (
      SELECT id,1 AS height FROM monitor_groups WHERE id=${id} AND workspace_id=${workspaceId}
      UNION ALL SELECT g.id,t.height+1 FROM monitor_groups g JOIN tree t ON g.parent_id=t.id WHERE t.height<${MAX_GROUP_DEPTH + 1}
    ) SELECT max(height)::int AS height FROM tree`
  return row?.height ?? 1
}

export async function assertGroupCapacity(db: any, workspaceId: number, adding: number) {
  if (await db.monitorGroup.count({where: {workspaceId}}) + adding > MAX_GROUPS_PER_WORKSPACE) {
    throw createError({statusCode: 400, message: `A workspace can hold at most ${MAX_GROUPS_PER_WORKSPACE} groups`})
  }
}

/** Groups with monitor counts for the selected environment, ordered for display. */
export async function listGroups(workspaceId: number, environmentId: number) {
  const [groups, counts, ungrouped] = await Promise.all([
    prisma.monitorGroup.findMany({where: {workspaceId}, orderBy: [{sortOrder: 'asc'}, {name: 'asc'}, {id: 'asc'}]}),
    prisma.monitor.groupBy({by: ['groupId'], where: {workspaceId, environmentId, groupId: {not: null}}, _count: {id: true}}),
    prisma.monitor.count({where: {workspaceId, environmentId, groupId: null}}),
  ])
  const byGroup = new Map(counts.map(row => [row.groupId, row._count.id]))
  return {
    groups: groups.map(group => ({...group, monitorCount: byGroup.get(group.id) ?? 0})),
    ungrouped,
  }
}

type TargetGroup = BrunoManifest['targetGroup']

/** Folder path → group id the import will use; `null` for the collection root when targetGroup is 'none'. */
export interface GroupPlan {path: string; name: string; groupId: number | null; exists: boolean}

/**
 * Works out which groups an import touches. With `create`, missing groups are inserted
 * (the caller holds the workspace row lock, so concurrent imports cannot race the unique index).
 */
export async function resolveBrunoGroups(db: any, workspaceId: number, manifest: BrunoManifest, parsed: BrunoParsed, create: boolean): Promise<GroupPlan[]> {
  const target: TargetGroup = manifest.targetGroup ?? 'collection'
  const existing: GroupRow[] = await db.monitorGroup.findMany({where: {workspaceId, sourceKind: 'bruno', collectionId: manifest.collectionId}})
  const bySource = new Map(existing.map(group => [group.sourcePath, group]))
  const plan: GroupPlan[] = []
  const ids = new Map<string, number | null>()
  if (parsed.folders.some(folder => folder.path.split('/').length >= MAX_GROUP_DEPTH)) {
    throw createError({statusCode: 400, message: `Bruno folders can be nested at most ${MAX_GROUP_DEPTH - 1} levels deep`})
  }
  if (create) {
    const needsRoot = target === 'collection' && !bySource.has('')
    await assertGroupCapacity(db, workspaceId, parsed.folders.filter(folder => !bySource.has(folder.path)).length + (needsRoot ? 1 : 0))
  }

  if (typeof target === 'number') {
    const group = await findGroup(db, workspaceId, target)
    ids.set('', group.id)
    plan.push({path: '', name: group.name, groupId: group.id, exists: true})
  } else if (target === 'none') {
    ids.set('', null)
  } else {
    const name = (parsed.collectionName || manifest.collectionId).slice(0, 150)
    let root = bySource.get('')
    if (!root && create) root = await db.monitorGroup.create({data: {workspaceId, name, sourceKind: 'bruno', collectionId: manifest.collectionId, sourcePath: ''}})
    ids.set('', root?.id ?? null)
    plan.push({path: '', name: root?.name ?? name, groupId: root?.id ?? null, exists: !!bySource.get('')})
  }

  // parsed.folders is ordered parents-first, so a parent id is always known before its children.
  for (const folder of parsed.folders) {
    let group = bySource.get(folder.path)
    if (!group && create) {
      const parentPath = folder.path.includes('/') ? folder.path.slice(0, folder.path.lastIndexOf('/')) : ''
      group = await db.monitorGroup.create({data: {
        workspaceId, parentId: ids.get(parentPath) ?? null, name: folder.name, sortOrder: folder.seq ?? 0,
        sourceKind: 'bruno', collectionId: manifest.collectionId, sourcePath: folder.path,
      }})
    }
    ids.set(folder.path, group?.id ?? null)
    plan.push({path: folder.path, name: group?.name ?? folder.name, groupId: group?.id ?? null, exists: bySource.has(folder.path)})
  }
  return plan
}

/** Moves monitors of the current environment into a group (or out of all groups with null). */
export async function moveMonitors(workspaceId: number, environmentId: number, monitorIds: number[], groupId: number | null) {
  return prisma.$transaction(async tx => {
    if (groupId !== null) await findGroup(tx, workspaceId, groupId)
    const result = await tx.monitor.updateMany({where: {id: {in: monitorIds}, workspaceId, environmentId}, data: {groupId}})
    if (result.count !== monitorIds.length) throw createError({statusCode: 404, message: 'Monitor not found'})
    return result.count
  })
}

/**
 * Deletes a group subtree. With 'delete', monitors of the selected environment are deleted too;
 * monitors of other environments always move up to the deleted group's parent.
 */
export async function deleteGroup(workspaceId: number, environmentId: number, id: number, monitors: 'keep' | 'delete') {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT id FROM workspaces WHERE id=${workspaceId} FOR UPDATE`
    const group = await findGroup(tx, workspaceId, id)
    const ids = await subtreeIds(tx, workspaceId, id)
    let deletedMonitorIds: number[] = []
    if (monitors === 'delete') {
      const rows = await tx.monitor.findMany({where: {workspaceId, environmentId, groupId: {in: ids}}, select: {id: true}})
      deletedMonitorIds = rows.map(row => row.id)
      if (deletedMonitorIds.length) await tx.$executeRaw(Prisma.sql`DELETE FROM monitors WHERE workspace_id=${workspaceId} AND environment_id=${environmentId} AND id IN (${Prisma.join(deletedMonitorIds)})`)
    }
    await tx.monitor.updateMany({where: {workspaceId, groupId: {in: ids}}, data: {groupId: group.parentId}})
    await tx.monitorGroup.delete({where: {id}})
    return {deletedGroups: ids.length, deletedMonitorIds}
  })
}
