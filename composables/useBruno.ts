import type {BrunoFile} from '../shared/types/bruno'

export interface MonitorGroup {
  id: number
  parentId: number | null
  name: string
  sortOrder: number
  sourceKind: 'manual' | 'bruno'
  collectionId: string | null
  sourcePath: string | null
  monitorCount: number
}
/** A group placed in the tree: depth for indentation, total counts its whole subtree. */
export interface GroupNode extends MonitorGroup {depth: number; total: number; children: GroupNode[]}

export const BRUNO_LIMITS = {files: 4500, totalBytes: 20 * 1024 * 1024, fileBytes: 131072}

/** Shared monitor-group state for the Groups page, Bruno import and monitor detail. */
export function useMonitorGroups() {
  const groups = useState<MonitorGroup[]>('monitor-groups', () => [])
  const ungrouped = useState<number>('monitor-groups-ungrouped', () => 0)
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const response = await $fetch<{data: {groups: MonitorGroup[]; ungrouped: number}}>('/api/v1/groups')
      groups.value = response.data.groups
      ungrouped.value = response.data.ungrouped
    } finally {
      loading.value = false
    }
  }

  const tree = computed<GroupNode[]>(() => {
    const nodes = new Map<number, GroupNode>(groups.value.map(group => [group.id, {...group, depth: 0, total: group.monitorCount, children: []}]))
    const roots: GroupNode[] = []
    for (const node of nodes.values()) {
      const parent = node.parentId === null ? undefined : nodes.get(node.parentId)
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    const sort = (list: GroupNode[]) => list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id - b.id)
    const visit = (list: GroupNode[], depth: number): number => sort(list).reduce((sum, node) => {
      node.depth = depth
      node.total = node.monitorCount + visit(node.children, depth + 1)
      return sum + node.total
    }, 0)
    visit(roots, 0)
    return roots
  })

  /** Depth-first list, handy for <select> options with indentation. */
  const flat = computed(() => {
    const result: GroupNode[] = []
    const walk = (list: GroupNode[]) => list.forEach(node => { result.push(node); walk(node.children) })
    walk(tree.value)
    return result
  })

  const pathOf = (id: number | null | undefined) => {
    const names: string[] = []
    for (let group = groups.value.find(item => item.id === id); group; group = groups.value.find(item => item.id === group!.parentId)) names.unshift(group.name)
    return names.join(' / ')
  }

  return {groups, ungrouped, tree, flat, loading, load, pathOf}
}

/** Downloads a Bruno export (.bru or .zip) and reports how many monitors were left out. */
export async function downloadBruno(query: Record<string, string | number>) {
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]))
  const response = await fetch(`/api/v1/bruno/download?${params}`, {credentials: 'same-origin'})
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Export failed')
  }
  const disposition = response.headers.get('content-disposition') || ''
  const encoded = /filename\*=UTF-8''([^;]+)/.exec(disposition)?.[1]
  const name = encoded ? decodeURIComponent(encoded) : 'bruno-export'
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return {
    name,
    exported: Number(response.headers.get('x-bruno-exported') || 1),
    skipped: Number(response.headers.get('x-bruno-skipped') || 0),
    secretNames: (response.headers.get('x-bruno-secret-names') || '').split(',').filter(Boolean),
  }
}

/**
 * Reads .bru files and bruno.json from a ZIP in the browser (DecompressionStream, no library).
 * When every entry sits under one top-level directory (Bruno's usual layout) it is stripped.
 */
export async function readBrunoZip(file: File): Promise<{files: BrunoFile[]; ignored: number}> {
  if (file.size > 64 * 1024 * 1024) throw new Error('ZIP file exceeds 64 MiB.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer)
  let end = -1
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index--) {
    if (view.getUint32(index, true) === 0x06054b50) { end = index; break }
  }
  if (end < 0) throw new Error('Not a ZIP file.')
  const count = view.getUint16(end + 10, true)
  let offset = view.getUint32(end + 16, true)
  if (count > BRUNO_LIMITS.files * 2) throw new Error(`ZIP contains more than ${BRUNO_LIMITS.files} files.`)
  const decoder = new TextDecoder()
  const entries: BrunoFile[] = []
  let ignored = 0, total = 0
  for (let index = 0; index < count; index++) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Damaged ZIP directory.')
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const size = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength
    const base = path.split('/').pop() || ''
    if (path.endsWith('/') || path.startsWith('__MACOSX/') || base.startsWith('.') || !(base.endsWith('.bru') || base === 'bruno.json')) { ignored++; continue }
    if (size > BRUNO_LIMITS.fileBytes) throw new Error(`${path} is larger than 128 KiB.`)
    total += size
    if (total > BRUNO_LIMITS.totalBytes) throw new Error('ZIP content exceeds 20 MiB.')
    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const raw = bytes.subarray(dataStart, dataStart + compressedSize)
    let content: Uint8Array
    if (method === 0) content = raw
    else if (method === 8) content = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    else throw new Error(`${path} uses an unsupported ZIP compression method.`)
    if (content.length > BRUNO_LIMITS.fileBytes) throw new Error(`${path} is larger than 128 KiB.`)
    entries.push({path, content: decoder.decode(content)})
  }
  const roots = new Set(entries.map(entry => entry.path.split('/')[0]))
  const root = roots.size === 1 && entries.every(entry => entry.path.includes('/')) ? [...roots][0] + '/' : ''
  return {files: entries.map(entry => ({path: entry.path.slice(root.length), content: entry.content})), ignored}
}
