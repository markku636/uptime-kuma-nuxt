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
