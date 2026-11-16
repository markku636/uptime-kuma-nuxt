import { describe, expect, it } from 'vitest'
import { aggregateGroupStatus, descendantIds, orderAsTree, wouldCreateCycle } from '../../server/services/workspace/tree'

// 1 (group) -> 2 (group) -> 3, 4 ; 1 -> 5 ; 6 is standalone
const nodes = [
  { id: 1, parent: null },
  { id: 2, parent: 1 },
  { id: 3, parent: 2 },
  { id: 4, parent: 2 },
  { id: 5, parent: 1 },
  { id: 6, parent: null },
]

describe('descendantIds', () => {
  it('collects every level below the root', () => {
    expect(descendantIds(nodes, 1).sort()).toEqual([2, 3, 4, 5])
    expect(descendantIds(nodes, 2).sort()).toEqual([3, 4])
    expect(descendantIds(nodes, 6)).toEqual([])
  })

  it('terminates on corrupted (cyclic) data', () => {
    const cyclic = [{ id: 1, parent: 2 }, { id: 2, parent: 1 }]
    expect(descendantIds(cyclic, 1)).toEqual([2])
  })
})

describe('wouldCreateCycle', () => {
  it('rejects self and descendants as parent', () => {
    expect(wouldCreateCycle(nodes, 1, 1)).toBe(true)
    expect(wouldCreateCycle(nodes, 1, 2)).toBe(true)
    expect(wouldCreateCycle(nodes, 1, 3)).toBe(true)
  })

  it('allows unrelated parents and detaching', () => {
    expect(wouldCreateCycle(nodes, 2, 6)).toBe(false)
    expect(wouldCreateCycle(nodes, 3, 1)).toBe(false)
    expect(wouldCreateCycle(nodes, 2, null)).toBe(false)
  })
})

describe('aggregateGroupStatus', () => {
  const m = (status: number | null, active = true) => ({ status, active })

  it('is pending when empty or everything is paused', () => {
    expect(aggregateGroupStatus([]).status).toBe(2)
    expect(aggregateGroupStatus([m(0, false), m(1, false)]).status).toBe(2)
  })

  it('is down when any active member is down', () => {
    const result = aggregateGroupStatus([m(1), m(0), m(2)])
    expect(result.status).toBe(0)
    expect(result.msg).toBe('1 of 3 members down')
  })

  it('is pending while a member has not reported up yet', () => {
    expect(aggregateGroupStatus([m(1), m(null)]).status).toBe(2)
    expect(aggregateGroupStatus([m(1), m(2)]).status).toBe(2)
  })

  it('is up when all counted members are up', () => {
    expect(aggregateGroupStatus([m(1), m(1)]).status).toBe(1)
  })

  it('ignores paused and maintenance members', () => {
    expect(aggregateGroupStatus([m(1), m(0, false), m(3)]).status).toBe(1)
    expect(aggregateGroupStatus([m(3), m(3)]).status).toBe(3)
  })
})

describe('orderAsTree', () => {
  const g = (id: number, name: string, parent: number | null = null) => ({ id, name, parent })

  it('puts children right after their parent with a path', () => {
    const out = orderAsTree([g(1, 'Web'), g(2, 'DB'), g(3, 'Edge', 1), g(4, 'CDN', 3)])
    expect(out.map(o => [o.path, o.depth])).toEqual([
      ['Web', 0], ['Web / Edge', 1], ['Web / Edge / CDN', 2], ['DB', 0],
    ])
  })

  it('treats a missing parent as root and survives cycles', () => {
    expect(orderAsTree([g(1, 'Orphan', 99)]).map(o => o.path)).toEqual(['Orphan'])
    const out = orderAsTree([g(1, 'A', 2), g(2, 'B', 1)])
    expect(out).toHaveLength(2)
  })
})
