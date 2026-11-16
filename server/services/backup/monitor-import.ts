// server/services/backup/monitor-import.ts
// Turns a monitor from a backup file into data for prisma.monitor.create/update.
// Ids in a backup belong to the database it was exported from, so every
// reference (workspace, proxy, group parent) is translated through an id map;
// anything that cannot be resolved is dropped instead of failing the import.
// Pure (no DB access), covered by tests/server/backup-monitor-import.test.ts.

export type IdMap = Map<number, number>

/** Columns never copied from a backup: identity, owner and references that are remapped */
const SKIPPED_FIELDS = new Set(['id', 'userId', 'createdAt', 'workspaceId', 'proxyId', 'parent', 'remoteBrowserId'])

export interface PreparedMonitor {
  data: Record<string, unknown>
  /** Group id in the source database, resolved once every monitor exists */
  oldParent: number | null
  tagIds: number[]
  notificationIds: number[]
}

const toId = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null
}

const mapIds = (ids: unknown[], map: IdMap) =>
  [...new Set(ids.map(toId).filter((id): id is number => id != null).map(id => map.get(id)).filter((id): id is number => id != null))]

/**
 * @param scalarFields names of the Monitor columns (Prisma.MonitorScalarFieldEnum)
 */
export function prepareMonitor(
  raw: Record<string, any>,
  scalarFields: readonly string[],
  maps: { workspaces: IdMap; proxies: IdMap; tags: IdMap; notifications: IdMap },
): PreparedMonitor {
  const data: Record<string, unknown> = {}
  for (const field of scalarFields) {
    if (SKIPPED_FIELDS.has(field) || !(field in raw)) continue
    // JSON columns cannot take a plain null through Prisma; leave them unset
    if (raw[field] === null && isJsonField(field)) continue
    data[field] = raw[field]
  }

  const workspaceId = toId(raw.workspaceId)
  data.workspaceId = workspaceId != null ? maps.workspaces.get(workspaceId) ?? null : null
  const proxyId = toId(raw.proxyId)
  data.proxyId = proxyId != null ? maps.proxies.get(proxyId) ?? null : null
  data.parent = null

  // Exports carry either flat id lists or the raw relation rows
  const tagIds = raw.tagIds ?? (raw.tags ?? []).map((t: any) => t?.tagId ?? t?.tag?.id)
  const notificationIds = raw.notificationIds ?? (raw.monitorNotifications ?? []).map((n: any) => n?.notificationId)

  return {
    data,
    oldParent: toId(raw.parent),
    tagIds: mapIds(Array.isArray(tagIds) ? tagIds : [], maps.tags),
    notificationIds: mapIds(Array.isArray(notificationIds) ? notificationIds : [], maps.notifications),
  }
}

const JSON_FIELDS = new Set(['headers', 'acceptedStatuscodes', 'kafkaBrokers', 'rabbitmqNodes', 'childrenIds', 'tlsExpiryDays', 'tlsInfo'])
function isJsonField(field: string) {
  return JSON_FIELDS.has(field)
}

/**
 * Parent ids for the restored monitors. A parent that is not in the backup
 * (or did not resolve) leaves the monitor ungrouped; a monitor never becomes
 * its own parent.
 */
export function resolveParents(oldParents: Map<number, number | null>, monitorMap: IdMap): Map<number, number | null> {
  const result = new Map<number, number | null>()
  for (const [newId, oldParent] of oldParents) {
    const parent = oldParent != null ? monitorMap.get(oldParent) ?? null : null
    result.set(newId, parent === newId ? null : parent)
  }
  return result
}
