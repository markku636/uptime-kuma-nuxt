import type { BrunoFile } from '../shared/types/bruno'

/** A tiny two-request collection that works on the current deployment. */
export function brunoTestExample() {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const files: BrunoFile[] = [1, 2].map(seq => ({
    path: `${seq === 1 ? '01' : '02'}-health.bru`,
    content: `meta {\n  name: ${seq === 1 ? 'Health live' : 'Health ready'}\n  type: http\n  seq: ${seq}\n}\n\nget {\n  url: ${origin}/api/health/${seq === 1 ? 'live' : 'ready'}\n  body: none\n  auth: none\n}\n\nassert {\n  res.status: in [200,503]\n}\n`,
  }))
  return { collectionId: 'quickstart', name: 'Quickstart · health checks', files }
}
