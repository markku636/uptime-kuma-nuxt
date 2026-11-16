import { describe, expect, it } from 'vitest'
import { prepareMonitor, resolveParents } from '../../server/services/backup/monitor-import'

const scalars = ['id', 'name', 'type', 'url', 'active', 'userId', 'createdAt', 'workspaceId', 'proxyId', 'parent', 'headers', 'tlsInfo', 'interval']
const maps = () => ({
  workspaces: new Map([[10, 100]]),
  proxies: new Map([[5, 50]]),
  tags: new Map([[1, 11], [2, 22]]),
  notifications: new Map([[7, 77]]),
})

describe('prepareMonitor', () => {
  const exported = {
    id: 3, userId: 9, createdAt: '2026-01-01', name: 'api', type: 'http', url: 'https://x', active: true,
    interval: 60, workspaceId: 10, proxyId: 5, parent: 2, headers: null, tlsInfo: { a: 1 },
    // relation rows as exported, plus fields the DB does not know
    tags: [{ tagId: 1 }], monitorNotifications: [{ notificationId: 7 }], heartbeats: [], unknownColumn: 'x',
    tagIds: [1, 2, 3], notificationIds: [7],
  }

  it('keeps only real columns and drops identity / owner', () => {
    const { data } = prepareMonitor(exported, scalars, maps())
    expect(data).toEqual({
      name: 'api', type: 'http', url: 'https://x', active: true, interval: 60, tlsInfo: { a: 1 },
      workspaceId: 100, proxyId: 50, parent: null,
    })
  })

  it('remaps references and drops the ones it cannot resolve', () => {
    const result = prepareMonitor({ ...exported, workspaceId: 99, proxyId: 99 }, scalars, maps())
    expect(result.data.workspaceId).toBeNull()
    expect(result.data.proxyId).toBeNull()
    expect(result.oldParent).toBe(2)
    expect(result.tagIds).toEqual([11, 22])
    expect(result.notificationIds).toEqual([77])
  })

  it('reads tag / notification ids from relation rows when flat lists are missing', () => {
    const { tagIds, notificationIds } = prepareMonitor({ name: 'x', tags: [{ tagId: 2 }], monitorNotifications: [{ notificationId: 7 }] }, scalars, maps())
    expect(tagIds).toEqual([22])
    expect(notificationIds).toEqual([77])
  })
})

describe('resolveParents', () => {
  it('maps parents to restored ids and ungroups the rest', () => {
    const monitorMap = new Map([[1, 101], [2, 102], [3, 103]])
    const result = resolveParents(new Map([[102, 1], [103, 2], [101, null], [104, 999]]), monitorMap)
    expect(Object.fromEntries(result)).toEqual({ 101: null, 102: 101, 103: 102, 104: null })
  })

  it('never makes a monitor its own parent', () => {
    expect(resolveParents(new Map([[101, 1]]), new Map([[1, 101]])).get(101)).toBeNull()
  })
})
