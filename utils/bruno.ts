// Import HTTP requests from Bruno (https://www.usebruno.com) as monitor drafts.
//
// Supported inputs
//   - .bru request files (Bruno Lang), optionally a whole collection folder:
//     collection.bru (shared headers/auth), folder.bru, environments/*.bru
//   - Bruno collection export JSON ("Export collection" in Bruno)
//
// Pure functions only, no Vue / Nuxt imports, so it can be unit tested.

export interface KeyValue {
  key: string
  value: string
}

export type BrunoAuth =
  | { mode: 'none' }
  | { mode: 'inherit' }
  | { mode: 'basic'; username: string; password: string }
  | { mode: 'bearer'; token: string }
  | { mode: 'unsupported'; type: string }

export interface BrunoRequest {
  /** Stable id within one import (file path or JSON path) */
  id: string
  name: string
  folder: string
  method: string
  url: string
  headers: KeyValue[]
  body: string
  bodyMode: 'none' | 'json' | 'text' | 'xml' | 'form' | 'unsupported'
  auth: BrunoAuth
  /** From `assert { res.status: … }` */
  expectedStatus: string[]
  /** From `assert { res.body: contains … }` */
  keyword: string
  seq: number
}

export interface BrunoEnvironment {
  name: string
  variables: Record<string, string>
}

export interface BrunoImport {
  collectionName: string
  requests: BrunoRequest[]
  environments: BrunoEnvironment[]
  /** Variables defined at collection level (collection.bru `vars:pre-request`) */
  collectionVars: Record<string, string>
  errors: string[]
}

export interface BrunoFile {
  /** Path relative to the selected folder, or just the file name */
  path: string
  text: string
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'connect', 'trace']

// ---------------------------------------------------------------------------
// .bru parsing
// ---------------------------------------------------------------------------

interface BruBlock {
  name: string
  /** key/value entries for dictionary blocks (disabled `~key` entries skipped) */
  dict: KeyValue[]
  /** raw content for text blocks (indentation removed) */
  text: string
  /** list entries for `name [ … ]` blocks */
  list: string[]
}

const TEXT_BLOCK = /^(body:(json|text|xml|graphql|graphql:vars|sparql)|script:.*|tests|docs)$/

function dedent(lines: string[]): string {
  return lines.map(l => (l.startsWith('  ') ? l.slice(2) : l.replace(/^\t/, ''))).join('\n').trim()
}

/** Split Bruno Lang into top-level blocks */
export function parseBruBlocks(source: string): BruBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: BruBlock[] = []
  let i = 0
  while (i < lines.length) {
    const open = /^([\w:.-]+)\s*([{[])\s*$/.exec(lines[i])
    if (!open) { i++; continue }
    const [, name, bracket] = open
    const close = bracket === '{' ? '}' : ']'
    const content: string[] = []
    i++
    while (i < lines.length && lines[i].trimEnd() !== close) {
      content.push(lines[i])
      i++
    }
    i++ // skip closing line

    const block: BruBlock = { name, dict: [], text: '', list: [] }
    if (bracket === '[') {
      block.list = content.map(l => l.trim().replace(/,$/, '')).filter(Boolean)
    } else if (TEXT_BLOCK.test(name)) {
      block.text = dedent(content)
    } else {
      for (const raw of content) {
        const line = raw.trim()
        if (!line || line.startsWith('~')) continue
        const idx = line.indexOf(':')
        if (idx <= 0) continue
        block.dict.push({ key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() })
      }
    }
    blocks.push(block)
  }
  return blocks
}

const dictGet = (b: BruBlock | undefined, key: string) => b?.dict.find(e => e.key === key)?.value ?? ''

function authFromBlocks(blocks: BruBlock[], mode: string): BrunoAuth {
  if (!mode || mode === 'none') return { mode: 'none' }
  if (mode === 'inherit') return { mode: 'inherit' }
  const block = blocks.find(b => b.name === `auth:${mode}`)
  if (mode === 'basic') return { mode: 'basic', username: dictGet(block, 'username'), password: dictGet(block, 'password') }
  if (mode === 'bearer') return { mode: 'bearer', token: dictGet(block, 'token') }
  return { mode: 'unsupported', type: mode }
}

/** Map assertions to accepted status codes and a keyword */
export function parseAssertions(entries: KeyValue[]): { expectedStatus: string[]; keyword: string } {
  const expectedStatus: string[] = []
  let keyword = ''
  for (const { key, value } of entries) {
    const [op, ...rest] = value.trim().split(/\s+/)
    const arg = rest.join(' ').replace(/^["']|["']$/g, '')
    if (key === 'res.status') {
      if (op === 'eq') expectedStatus.push(arg)
      else if (op === 'in') expectedStatus.push(...arg.replace(/[[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean))
      else if (op === 'gte' || op === 'lt' || op === 'lte' || op === 'gt') {
        // Build a range together with its counterpart, e.g. gte 200 + lt 300
        const n = Number(arg)
        if (!Number.isNaN(n)) expectedStatus.push(`${op}:${n}`)
      }
    } else if (key === 'res.body' && op === 'contains' && arg) {
      keyword = arg
    }
  }
  // Fold comparison pairs into ranges ("200-299")
  const lower = expectedStatus.find(s => s.startsWith('gte:') || s.startsWith('gt:'))
  const upper = expectedStatus.find(s => s.startsWith('lt:') || s.startsWith('lte:'))
  const plain = expectedStatus.filter(s => !s.includes(':'))
  if (lower || upper) {
    const lo = lower ? Number(lower.split(':')[1]) + (lower.startsWith('gt:') ? 1 : 0) : 100
    const hi = upper ? Number(upper.split(':')[1]) - (upper.startsWith('lt:') ? 1 : 0) : 599
    plain.push(`${lo}-${hi}`)
  }
  return { expectedStatus: plain.filter(s => /^\d{3}(-\d{3})?$/.test(s)), keyword }
}

function formEncode(entries: KeyValue[]): string {
  return entries.map(e => `${encodeURIComponent(e.key)}=${encodeURIComponent(e.value)}`).join('&')
}

/** Parse one .bru request file. Returns null for non-request files. */
export function parseBruRequest(source: string, path = 'request.bru'): BrunoRequest | null {
  const blocks = parseBruBlocks(source)
  const meta = blocks.find(b => b.name === 'meta')
  const methodBlock = blocks.find(b => HTTP_METHODS.includes(b.name))
  if (!methodBlock) return null
  if (meta && dictGet(meta, 'type') && dictGet(meta, 'type') !== 'http') return null

  const bodyMode = dictGet(methodBlock, 'body') || 'none'
  let body = ''
  let mode: BrunoRequest['bodyMode'] = 'none'
  if (bodyMode === 'json' || bodyMode === 'text' || bodyMode === 'xml') {
    body = blocks.find(b => b.name === `body:${bodyMode}`)?.text ?? ''
    mode = bodyMode
  } else if (bodyMode === 'formUrlEncoded' || bodyMode === 'form-urlencoded') {
    body = formEncode(blocks.find(b => b.name === 'body:form-urlencoded')?.dict ?? [])
    mode = 'form'
  } else if (bodyMode !== 'none') {
    mode = 'unsupported'
  }

  const parts = path.replace(/\\/g, '/').split('/')
  const fileName = parts.pop() || path

  return {
    id: path,
    name: dictGet(meta, 'name') || fileName.replace(/\.bru$/, ''),
    folder: parts.join('/'),
    method: methodBlock.name.toUpperCase(),
    url: dictGet(methodBlock, 'url'),
    headers: blocks.find(b => b.name === 'headers')?.dict ?? [],
    body,
    bodyMode: mode,
    auth: authFromBlocks(blocks, dictGet(methodBlock, 'auth')),
    ...parseAssertions(blocks.find(b => b.name === 'assert')?.dict ?? []),
    seq: Number(dictGet(meta, 'seq')) || 0,
  }
}

/** Parse an environment .bru file (`vars { … }`) */
export function parseBruEnvironment(source: string, name: string): BrunoEnvironment {
  const blocks = parseBruBlocks(source)
  const variables: Record<string, string> = {}
  for (const e of blocks.find(b => b.name === 'vars')?.dict ?? []) variables[e.key] = e.value
  // vars:secret only lists names; values live in Bruno's local store
  for (const secret of blocks.find(b => b.name === 'vars:secret')?.list ?? []) {
    if (!(secret in variables)) variables[secret] = ''
  }
  return { name, variables }
}

/** Parse a set of files picked by the user (single .bru files or a collection folder) */
export function parseBruFiles(files: BrunoFile[]): BrunoImport {
  const result: BrunoImport = { collectionName: '', requests: [], environments: [], collectionVars: {}, errors: [] }
  let collectionHeaders: KeyValue[] = []
  let collectionAuth: BrunoAuth = { mode: 'none' }

  // Paths from a folder picker start with the collection folder itself
  // ("shop/users/list.bru"); strip it so folders are relative to the collection.
  const normalized = files.map(f => f.path.replace(/\\/g, '/'))
  const brunoJson = normalized.find(p => p === 'bruno.json' || p.endsWith('/bruno.json'))
  let root = brunoJson ? brunoJson.slice(0, -'bruno.json'.length) : ''
  if (!brunoJson && normalized.length > 1 && normalized.every(p => p.includes('/'))) {
    const first = normalized[0].split('/')[0] + '/'
    if (normalized.every(p => p.startsWith(first))) root = first
  }

  for (const file of files) {
    const fullPath = file.path.replace(/\\/g, '/')
    const path = root && fullPath.startsWith(root) ? fullPath.slice(root.length) : fullPath
    const base = path.split('/').pop() || path
    try {
      if (base === 'bruno.json') {
        result.collectionName = JSON.parse(file.text).name || ''
      } else if (/(^|\/)environments\/[^/]+\.bru$/.test(path)) {
        result.environments.push(parseBruEnvironment(file.text, base.replace(/\.bru$/, '')))
      } else if (base === 'collection.bru') {
        const blocks = parseBruBlocks(file.text)
        collectionHeaders = blocks.find(b => b.name === 'headers')?.dict ?? []
        const authMode = dictGet(blocks.find(b => b.name === 'auth'), 'mode')
        collectionAuth = authFromBlocks(blocks, authMode)
        for (const e of blocks.find(b => b.name === 'vars:pre-request')?.dict ?? []) result.collectionVars[e.key] = e.value
      } else if (base === 'folder.bru') {
        continue
      } else if (base.endsWith('.bru')) {
        const req = parseBruRequest(file.text, path)
        if (req) result.requests.push(req)
      }
    } catch (e: any) {
      result.errors.push(`${path}: ${e?.message || 'parse error'}`)
    }
  }

  for (const req of result.requests) {
    const own = new Set(req.headers.map(h => h.key.toLowerCase()))
    req.headers = [...collectionHeaders.filter(h => !own.has(h.key.toLowerCase())), ...req.headers]
    if (req.auth.mode === 'inherit') req.auth = collectionAuth
  }
  result.requests.sort((a, b) => a.folder.localeCompare(b.folder) || a.seq - b.seq || a.name.localeCompare(b.name))
  return result
}

// ---------------------------------------------------------------------------
// Collection export JSON
// ---------------------------------------------------------------------------

const enabled = (list: any[] | undefined): KeyValue[] =>
  (list || []).filter(e => e && e.enabled !== false).map(e => ({ key: String(e.name ?? ''), value: String(e.value ?? '') }))

function authFromJson(auth: any): BrunoAuth {
  const mode = auth?.mode || 'none'
  if (mode === 'none') return { mode: 'none' }
  if (mode === 'inherit') return { mode: 'inherit' }
  if (mode === 'basic') return { mode: 'basic', username: auth.basic?.username ?? '', password: auth.basic?.password ?? '' }
  if (mode === 'bearer') return { mode: 'bearer', token: auth.bearer?.token ?? '' }
  return { mode: 'unsupported', type: mode }
}

export function parseBrunoCollectionJson(json: any): BrunoImport {
  const result: BrunoImport = { collectionName: json?.name || '', requests: [], environments: [], collectionVars: {}, errors: [] }
  if (!json || !Array.isArray(json.items)) {
    result.errors.push('Not a Bruno collection export (missing "items")')
    return result
  }
  const rootHeaders = enabled(json.root?.request?.headers)
  const rootAuth = authFromJson(json.root?.request?.auth)
  for (const e of enabled(json.root?.request?.vars?.req)) result.collectionVars[e.key] = e.value

  const walk = (items: any[], folder: string[], pathPrefix: string) => {
    items.forEach((item, index) => {
      const path = `${pathPrefix}/${index}`
      if (item?.type === 'folder') {
        walk(item.items || [], [...folder, item.name || 'folder'], path)
        return
      }
      if (item?.type !== 'http-request' || !item.request) return
      const r = item.request
      const bodyModeRaw = r.body?.mode || 'none'
      let body = ''
      let bodyMode: BrunoRequest['bodyMode'] = 'none'
      if (bodyModeRaw === 'json' || bodyModeRaw === 'text' || bodyModeRaw === 'xml') {
        body = r.body?.[bodyModeRaw] ?? ''
        bodyMode = bodyModeRaw
      } else if (bodyModeRaw === 'formUrlEncoded') {
        body = formEncode(enabled(r.body?.formUrlEncoded))
        bodyMode = 'form'
      } else if (bodyModeRaw !== 'none') {
        bodyMode = 'unsupported'
      }
      const own = enabled(r.headers)
      const ownKeys = new Set(own.map(h => h.key.toLowerCase()))
      let auth = authFromJson(r.auth)
      if (auth.mode === 'inherit') auth = rootAuth
      result.requests.push({
        id: path,
        name: item.name || r.url || 'Request',
        folder: folder.join('/'),
        method: String(r.method || 'GET').toUpperCase(),
        url: r.url || '',
        headers: [...rootHeaders.filter(h => !ownKeys.has(h.key.toLowerCase())), ...own],
        body,
        bodyMode,
        auth,
        ...parseAssertions(enabled(r.assertions)),
        seq: Number(item.seq) || index,
      })
    })
  }
  walk(json.items, [], '')

  for (const env of json.environments || []) {
    const variables: Record<string, string> = {}
    for (const v of env.variables || []) if (v?.enabled !== false && v?.name) variables[v.name] = String(v.value ?? '')
    result.environments.push({ name: env.name || 'Environment', variables })
  }
  return result
}

/** Accepts any mix of .bru files, bruno.json and collection export JSON */
export function parseBrunoInput(files: BrunoFile[]): BrunoImport {
  const exports = files.filter(f => f.path.endsWith('.json') && !f.path.endsWith('bruno.json'))
  const bru = files.filter(f => !exports.includes(f))
  const merged = parseBruFiles(bru)
  for (const file of exports) {
    try {
      const part = parseBrunoCollectionJson(JSON.parse(file.text))
      merged.requests.push(...part.requests.map(r => ({ ...r, id: `${file.path}${r.id}` })))
      merged.environments.push(...part.environments)
      Object.assign(merged.collectionVars, part.collectionVars)
      merged.errors.push(...part.errors.map(e => `${file.path}: ${e}`))
      merged.collectionName ||= part.collectionName
    } catch (e: any) {
      merged.errors.push(`${file.path}: ${e?.message || 'invalid JSON'}`)
    }
  }
  return merged
}

// ---------------------------------------------------------------------------
// Variables and conversion
// ---------------------------------------------------------------------------

const VAR = /\{\{\s*([\w.-]+)\s*\}\}/g

export function interpolate(text: string, vars: Record<string, string>): string {
  // Two passes so variables may reference other variables
  let out = text
  for (let i = 0; i < 2; i++) out = out.replace(VAR, (m, name) => (name in vars && vars[name] !== '' ? vars[name] : m))
  return out
}

export function unresolvedVariables(text: string): string[] {
  return [...new Set([...text.matchAll(VAR)].map(m => m[1]))]
}

export function resolveRequest(req: BrunoRequest, vars: Record<string, string>): BrunoRequest {
  const auth: BrunoAuth = req.auth.mode === 'basic'
    ? { ...req.auth, username: interpolate(req.auth.username, vars), password: interpolate(req.auth.password, vars) }
    : req.auth.mode === 'bearer'
      ? { ...req.auth, token: interpolate(req.auth.token, vars) }
      : req.auth
  return {
    ...req,
    url: interpolate(req.url, vars),
    headers: req.headers.map(h => ({ key: interpolate(h.key, vars), value: interpolate(h.value, vars) })),
    body: interpolate(req.body, vars),
    auth,
  }
}

export interface MonitorDraft {
  type: 'http' | 'keyword'
  name: string
  url: string
  method: string
  body: string
  headers: KeyValue[]
  authMethod: '' | 'basic'
  basicAuthUser: string
  basicAuthPass: string
  keyword: string
  acceptedStatuscodes: string[]
  /** Problems the user should know about before saving */
  warnings: string[]
}

const CONTENT_TYPE: Record<string, string> = {
  json: 'application/json',
  xml: 'application/xml',
  text: 'text/plain',
  form: 'application/x-www-form-urlencoded',
}

/** Convert a (resolved) Bruno request into a monitor draft */
export function toMonitorDraft(req: BrunoRequest): MonitorDraft {
  const warnings: string[] = []
  const headers = req.headers.filter(h => h.key)
  const hasHeader = (name: string) => headers.some(h => h.key.toLowerCase() === name)

  if (req.body && CONTENT_TYPE[req.bodyMode] && !hasHeader('content-type')) {
    headers.push({ key: 'Content-Type', value: CONTENT_TYPE[req.bodyMode] })
  }
  if (req.bodyMode === 'unsupported') warnings.push('Body type is not supported and was skipped')

  let authMethod: MonitorDraft['authMethod'] = ''
  let basicAuthUser = ''
  let basicAuthPass = ''
  if (req.auth.mode === 'basic') {
    authMethod = 'basic'
    basicAuthUser = req.auth.username
    basicAuthPass = req.auth.password
  } else if (req.auth.mode === 'bearer' && req.auth.token && !hasHeader('authorization')) {
    headers.push({ key: 'Authorization', value: `Bearer ${req.auth.token}` })
  } else if (req.auth.mode === 'unsupported') {
    warnings.push(`Auth "${req.auth.type}" is not supported; add it manually`)
  }

  const missing = unresolvedVariables([req.url, req.body, basicAuthUser, basicAuthPass, ...headers.map(h => h.value)].join('\n'))
  if (missing.length) warnings.push(`Unresolved variables: ${missing.join(', ')}`)
  if (req.url && !/^https?:\/\//i.test(req.url) && !missing.length) warnings.push('URL must start with http:// or https://')

  return {
    type: req.keyword ? 'keyword' : 'http',
    name: req.folder ? `${req.folder.split('/').pop()} / ${req.name}` : req.name,
    url: req.url,
    method: req.method,
    body: req.body,
    headers,
    authMethod,
    basicAuthUser,
    basicAuthPass,
    keyword: req.keyword,
    acceptedStatuscodes: req.expectedStatus.length ? req.expectedStatus : ['200-299'],
    warnings,
  }
}

/** True when a draft can be saved without the user fixing anything */
export function isDraftReady(draft: MonitorDraft): boolean {
  return /^https?:\/\//i.test(draft.url) && unresolvedVariables(draft.url).length === 0
    && !draft.warnings.some(w => w.startsWith('Unresolved'))
}
