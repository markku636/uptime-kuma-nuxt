// server/services/workspace/tree.ts
// Pure helpers for the Workspace -> Group -> Monitor hierarchy (no DB access,
// covered by tests/server/workspace-tree.test.ts).
//
// A group is a monitor with type "group"; its members point at it via `parent`.

export interface TreeNode {
  id: number
  parent: number | null
}

/** Ids of every monitor below `rootId` (children, grandchildren, ...) */
export function descendantIds(nodes: TreeNode[], rootId: number): number[] {
  const childrenOf = new Map<number, number[]>()
  for (const node of nodes) {
    if (node.parent == null) continue
    const list = childrenOf.get(node.parent)
    if (list) list.push(node.id)
    else childrenOf.set(node.parent, [node.id])
  }

  const result: number[] = []
  const seen = new Set<number>([rootId])
  const queue = [rootId]
  while (queue.length) {
    const current = queue.shift()!
    for (const child of childrenOf.get(current) ?? []) {
      if (seen.has(child)) continue
      seen.add(child)
      result.push(child)
      queue.push(child)
    }
  }
  return result
}

/** True when moving `id` under `newParent` would make it its own ancestor */
export function wouldCreateCycle(nodes: TreeNode[], id: number, newParent: number | null): boolean {
  if (newParent == null) return false
  if (newParent === id) return true
  return descendantIds(nodes, id).includes(newParent)
}

export interface GroupMemberStatus {
  active: boolean
  /** Latest heartbeat status (0 down, 1 up, 2 pending, 3 maintenance) or null when never checked */
  status: number | null
}

/**
 * Status of a group derived from its members, same rules as upstream Uptime Kuma:
 * any member down -> down, any member pending / not checked yet -> pending,
 * otherwise up. Paused members and members under maintenance are ignored.
 */
export function aggregateGroupStatus(members: GroupMemberStatus[]): { status: number; msg: string } {
  const active = members.filter(m => m.active)
  if (active.length === 0) {
    return { status: 2, msg: members.length === 0 ? 'Group empty' : 'All members are paused' }
  }

  const counted = active.filter(m => m.status !== 3)
  if (counted.length === 0) return { status: 3, msg: 'All members are under maintenance' }

  const down = counted.filter(m => m.status === 0).length
  if (down > 0) return { status: 0, msg: `${down} of ${counted.length} members down` }

  const pending = counted.filter(m => m.status !== 1).length
  if (pending > 0) return { status: 2, msg: `${pending} of ${counted.length} members pending` }

  return { status: 1, msg: 'All members are healthy' }
}

export interface TreeOrderItem extends TreeNode {
  name: string
}

/**
 * Groups in tree order (each parent followed by its children, siblings in
 * the given order) with their depth and "Parent / Child" path. A group whose
 * parent is not in the list is treated as a root. Safe on cyclic data.
 */
export function orderAsTree<T extends TreeOrderItem>(items: T[]): { item: T; depth: number; path: string }[] {
  const ids = new Set(items.map(i => i.id))
  const children = new Map<number | null, T[]>()
  for (const item of items) {
    const key = item.parent != null && ids.has(item.parent) && item.parent !== item.id ? item.parent : null
    const list = children.get(key)
    if (list) list.push(item)
    else children.set(key, [item])
  }

  const result: { item: T; depth: number; path: string }[] = []
  const seen = new Set<number>()
  const visit = (parent: number | null, depth: number, prefix: string) => {
    for (const item of children.get(parent) ?? []) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      const path = prefix ? `${prefix} / ${item.name}` : item.name
      result.push({ item, depth, path })
      visit(item.id, depth + 1, path)
    }
  }
  visit(null, 0, '')
  // Members of a cycle have no root: list them at the top level
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      result.push({ item, depth: 0, path: item.name })
      visit(item.id, 1, item.name)
    }
  }
  return result
}

export interface PlacedNode extends TreeNode {
  workspaceId: number | null
}

/**
 * Members must live in their group's workspace, all the way down: the
 * workspace of a top-level group (or ungrouped monitor) wins. Returns the
 * rows whose workspace has to change. Rows on a cycle are left alone.
 */
export function workspaceCorrections(nodes: PlacedNode[]): { id: number; workspaceId: number | null }[] {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const children = new Map<number, PlacedNode[]>()
  for (const node of nodes) {
    if (node.parent == null || !byId.has(node.parent)) continue
    const list = children.get(node.parent)
    if (list) list.push(node)
    else children.set(node.parent, [node])
  }

  const fixes: { id: number; workspaceId: number | null }[] = []
  const seen = new Set<number>()
  const visit = (node: PlacedNode, workspaceId: number | null) => {
    for (const child of children.get(node.id) ?? []) {
      if (seen.has(child.id)) continue
      seen.add(child.id)
      if ((child.workspaceId ?? null) !== workspaceId) fixes.push({ id: child.id, workspaceId })
      visit(child, workspaceId)
    }
  }
  for (const root of nodes.filter(n => n.parent == null || !byId.has(n.parent))) {
    seen.add(root.id)
    visit(root, root.workspaceId ?? null)
  }
  return fixes
}
