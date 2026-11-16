// Import HTTP requests from Bruno (https://www.usebruno.com) as monitor drafts.
//
// Supported inputs
//   - .bru request files (Bruno Lang), optionally a whole collection folder:
//     bruno.json, collection.bru and folder.bru (headers / auth / vars that
//     requests inherit), environments/*.bru, and the collection's .env file
//     ({{process.env.NAME}})
//   - Bruno collection export JSON ("Export collection" in Bruno)
//
// Variables follow Bruno's precedence (lowest first): collection vars,
// environment, folder vars (outer to inner), request vars; values the user
// enters in the import dialog override all of them.
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
  | { mode: 'apikey'; key: string; value: string; placement: 'header' | 'queryparams' }
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
  /** Folder and request variables (vars:pre-request), inner ones win */
  vars: Record<string, string>
  /** From `assert { res.status: … }` */
  expectedStatus: string[]
  /** From `assert { res.body: contains … }` */
  keyword: string
  seq: number
}

export interface BrunoEnvironment {
  name: string
  variables: Record<string, string>
  /** Variables marked secret in Bruno: their values are not in the files */
  secrets: string[]
}

export interface BrunoImport {
  collectionName: string
  requests: BrunoRequest[]
  environments: BrunoEnvironment[]
  /** Variables defined at collection level (collection.bru `vars:pre-request`, .env as process.env.*) */
  collectionVars: Record<string, string>
  /** Names whose values should be masked (environment secrets, .env values) */
  secretVars: string[]
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
      for (let j = 0; j < content.length; j++) {
        const line = content[j].trim()
        if (!line) continue
        const idx = line.indexOf(':')
        if (idx <= 0) continue
        const key = line.slice(0, idx).trim()
        let value = line.slice(idx + 1).trim()
        // Multi-line value:  key: '''  …  '''
        if (value === "'''") {
          const lines: string[] = []
          for (j++; j < content.length && content[j].trim() !== "'''"; j++) lines.push(content[j])
          value = dedent(lines.map(l => l.replace(/^ {2}/, '')))
        }
        if (key.startsWith('~')) continue // disabled entry
        block.dict.push({ key, value })
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
  if (mode === 'apikey') {
    return {
      mode: 'apikey',
      key: dictGet(block, 'key'),
      value: dictGet(block, 'value'),
      placement: dictGet(block, 'placement') === 'queryparams' ? 'queryparams' : 'header',
    }
  }
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

/** Replace `/:name` path segments with their values (`params:path`) */
export function applyPathParams(url: string, params: KeyValue[]): string {
  if (!params.length) return url
  const values = new Map(params.map(p => [p.key, p.value]))
  return url.replace(/\/:([A-Za-z_][\w-]*)/g, (m, name) => (values.has(name) ? `/${values.get(name)}` : m))
}

/** GraphQL query + variables as the JSON body a GraphQL server expects */
export function graphqlBody(query: string, variables: string): string {
  let vars: unknown = {}
  if (variables.trim()) {
    try { vars = JSON.parse(variables) } catch { vars = variables }
  }
  return JSON.stringify({ query, variables: vars })
}

const toVars = (entries: KeyValue[] | undefined): Record<string, string> =>
  Object.fromEntries((entries ?? []).map(e => [e.key, e.value]))

/** Parse one .bru request file. Returns null for non-request files. */
export function parseBruRequest(source: string, path = 'request.bru'): BrunoRequest | null {
  const blocks = parseBruBlocks(source)
  const meta = blocks.find(b => b.name === 'meta')
  const methodBlock = blocks.find(b => HTTP_METHODS.includes(b.name))
  if (!methodBlock) return null
  const type = dictGet(meta, 'type')
  if (type && type !== 'http' && type !== 'graphql') return null

  const bodyMode = dictGet(methodBlock, 'body') || 'none'
  let body = ''
  let mode: BrunoRequest['bodyMode'] = 'none'
  if (bodyMode === 'json' || bodyMode === 'text' || bodyMode === 'xml') {
    body = blocks.find(b => b.name === `body:${bodyMode}`)?.text ?? ''
    mode = bodyMode
  } else if (bodyMode === 'formUrlEncoded' || bodyMode === 'form-urlencoded') {
    body = formEncode(blocks.find(b => b.name === 'body:form-urlencoded')?.dict ?? [])
    mode = 'form'
  } else if (bodyMode === 'graphql' || type === 'graphql') {
    const query = blocks.find(b => b.name === 'body:graphql')?.text ?? ''
    if (query) {
      body = graphqlBody(query, blocks.find(b => b.name === 'body:graphql:vars')?.text ?? '')
      mode = 'json'
    }
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
    url: applyPathParams(dictGet(methodBlock, 'url'), blocks.find(b => b.name === 'params:path')?.dict ?? []),
    headers: blocks.find(b => b.name === 'headers')?.dict ?? [],
    body,
    bodyMode: mode,
    auth: authFromBlocks(blocks, dictGet(methodBlock, 'auth')),
    vars: toVars(blocks.find(b => b.name === 'vars:pre-request')?.dict),
    ...parseAssertions(blocks.find(b => b.name === 'assert')?.dict ?? []),
    seq: Number(dictGet(meta, 'seq')) || 0,
  }
}

/** Parse an environment .bru file (`vars { … }`, `vars:secret [ … ]`) */
export function parseBruEnvironment(source: string, name: string): BrunoEnvironment {
  const blocks = parseBruBlocks(source)
  const variables: Record<string, string> = {}
  for (const e of blocks.find(b => b.name === 'vars')?.dict ?? []) variables[e.key] = e.value
  // vars:secret only lists names; values live in Bruno's local store
  const secrets = blocks.find(b => b.name === 'vars:secret')?.list.map(s => s.replace(/^~/, '')) ?? []
  for (const secret of secrets) {
    if (!(secret in variables)) variables[secret] = ''
  }
  return { name, variables, secrets }
}

/** Parse a .env file (KEY=value, # comments, optional quotes) */
export function parseDotEnv(source: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    let value = m[2].trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '')
    vars[m[1]] = value
  }
  return vars
}

/** Headers / auth / vars a folder (folder.bru) or the collection passes down */
interface Inherited {
  headers: KeyValue[]
  auth: BrunoAuth
  vars: Record<string, string>
}

function inheritedFromBlocks(blocks: BruBlock[]): Inherited {
  return {
    headers: blocks.find(b => b.name === 'headers')?.dict ?? [],
    auth: authFromBlocks(blocks, dictGet(blocks.find(b => b.name === 'auth'), 'mode') || 'inherit'),
    vars: toVars(blocks.find(b => b.name === 'vars:pre-request')?.dict),
  }
}

/** Child headers win over parent headers with the same name (case-insensitive) */
function mergeHeaders(parent: KeyValue[], child: KeyValue[]): KeyValue[] {
  const own = new Set(child.map(h => h.key.toLowerCase()))
  return [...parent.filter(h => !own.has(h.key.toLowerCase())), ...child]
}

/**
 * Apply collection and folder settings to a request: headers merged from the
 * outside in, `inherit` auth taken from the nearest folder that sets one,
 * folder variables under the request's own.
 */
function applyInheritance(req: BrunoRequest, collection: Inherited, folders: Map<string, Inherited>) {
  const chain: Inherited[] = [collection]
  const segments = req.folder ? req.folder.split('/') : []
  for (let i = 1; i <= segments.length; i++) {
    const folder = folders.get(segments.slice(0, i).join('/'))
    if (folder) chain.push(folder)
  }

  let headers: KeyValue[] = []
  let auth: BrunoAuth = { mode: 'none' }
  let vars: Record<string, string> = {}
  for (const level of chain) {
    headers = mergeHeaders(headers, level.headers)
    if (level.auth.mode !== 'inherit') auth = level.auth
    // Collection vars are kept apart (below the environment); folders are not
    if (level !== collection) vars = { ...vars, ...level.vars }
  }
  req.headers = mergeHeaders(headers, req.headers)
  if (req.auth.mode === 'inherit') req.auth = auth
  req.vars = { ...vars, ...req.vars }
}

/** Parse a set of files picked by the user (single .bru files or a collection folder) */
export function parseBruFiles(files: BrunoFile[]): BrunoImport {
  const result: BrunoImport = { collectionName: '', requests: [], environments: [], collectionVars: {}, secretVars: [], errors: [] }
  let collection: Inherited = { headers: [], auth: { mode: 'none' }, vars: {} }
  const folders = new Map<string, Inherited>()

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
    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    try {
      if (base === 'bruno.json') {
        result.collectionName = JSON.parse(file.text).name || ''
      } else if (base === '.env' && !dir) {
        // Bruno exposes the collection's .env as {{process.env.NAME}}
        for (const [key, value] of Object.entries(parseDotEnv(file.text))) {
          result.collectionVars[`process.env.${key}`] = value
          result.secretVars.push(`process.env.${key}`)
        }
      } else if (/(^|\/)environments\/[^/]+\.bru$/.test(path)) {
        const env = parseBruEnvironment(file.text, base.replace(/\.bru$/, ''))
        result.environments.push(env)
        result.secretVars.push(...env.secrets)
      } else if (base === 'collection.bru') {
        collection = inheritedFromBlocks(parseBruBlocks(file.text))
        if (collection.auth.mode === 'inherit') collection.auth = { mode: 'none' }
        Object.assign(result.collectionVars, collection.vars)
      } else if (base === 'folder.bru') {
        folders.set(dir, inheritedFromBlocks(parseBruBlocks(file.text)))
      } else if (base.endsWith('.bru')) {
        const req = parseBruRequest(file.text, path)
        if (req) {
          result.requests.push(req)
        } else if (/^vars(:secret)?\s*[{[]/m.test(file.text)) {
          // An environment file picked on its own (outside environments/)
          const env = parseBruEnvironment(file.text, base.replace(/\.bru$/, ''))
          result.environments.push(env)
          result.secretVars.push(...env.secrets)
        }
      }
    } catch (e: any) {
      result.errors.push(`${path}: ${e?.message || 'parse error'}`)
    }
  }

  for (const req of result.requests) applyInheritance(req, collection, folders)
  result.secretVars = [...new Set(result.secretVars)]
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
  if (mode === 'apikey') {
    return {
      mode: 'apikey',
      key: auth.apikey?.key ?? '',
      value: auth.apikey?.value ?? '',
      placement: auth.apikey?.placement === 'queryparams' ? 'queryparams' : 'header',
    }
  }
  return { mode: 'unsupported', type: mode }
}

/** Folder / collection settings in an export (`root.request`) */
function inheritedFromJson(root: any): Inherited {
  const request = root?.request
  return {
    headers: enabled(request?.headers),
    auth: request?.auth ? authFromJson(request.auth) : { mode: 'inherit' },
    vars: toVars(enabled(request?.vars?.req)),
  }
}

/** An environment as Bruno exports it: { name, variables: [{ name, value, enabled, secret }] } */
export function environmentFromJson(env: any, fallbackName: string): BrunoEnvironment {
  const variables: Record<string, string> = {}
  const secrets: string[] = []
  for (const v of env?.variables || []) {
    if (v?.enabled === false || !v?.name) continue
    variables[v.name] = String(v.value ?? '')
    if (v.secret) secrets.push(v.name)
  }
  return { name: env?.name || fallbackName, variables, secrets }
}

export function parseBrunoCollectionJson(json: any): BrunoImport {
  const result: BrunoImport = { collectionName: json?.name || '', requests: [], environments: [], collectionVars: {}, secretVars: [], errors: [] }
  if (!json || !Array.isArray(json.items)) {
    result.errors.push('Not a Bruno collection export (missing "items")')
    return result
  }
  const collection = inheritedFromJson(json.root)
  if (collection.auth.mode === 'inherit') collection.auth = { mode: 'none' }
  Object.assign(result.collectionVars, collection.vars)
  const folders = new Map<string, Inherited>()

  const walk = (items: any[], folder: string[], pathPrefix: string) => {
    items.forEach((item, index) => {
      const path = `${pathPrefix}/${index}`
      if (item?.type === 'folder') {
        const next = [...folder, item.name || 'folder']
        if (item.root) folders.set(next.join('/'), inheritedFromJson(item.root))
        walk(item.items || [], next, path)
        return
      }
      if ((item?.type !== 'http-request' && item?.type !== 'graphql-request') || !item.request) return
      const r = item.request
      const bodyModeRaw = r.body?.mode || (item.type === 'graphql-request' ? 'graphql' : 'none')
      let body = ''
      let bodyMode: BrunoRequest['bodyMode'] = 'none'
      if (bodyModeRaw === 'json' || bodyModeRaw === 'text' || bodyModeRaw === 'xml') {
        body = r.body?.[bodyModeRaw] ?? ''
        bodyMode = bodyModeRaw
      } else if (bodyModeRaw === 'formUrlEncoded') {
        body = formEncode(enabled(r.body?.formUrlEncoded))
        bodyMode = 'form'
      } else if (bodyModeRaw === 'graphql') {
        const query = r.body?.graphql?.query ?? ''
        if (query) {
          body = graphqlBody(query, r.body?.graphql?.variables ?? '')
          bodyMode = 'json'
        }
      } else if (bodyModeRaw !== 'none') {
        bodyMode = 'unsupported'
      }
      const pathParams = enabled((r.params || []).filter((p: any) => p?.type === 'path'))
      result.requests.push({
        id: path,
        name: item.name || r.url || 'Request',
        folder: folder.join('/'),
        method: String(r.method || 'GET').toUpperCase(),
        url: applyPathParams(r.url || '', pathParams),
        headers: enabled(r.headers),
        body,
        bodyMode,
        auth: authFromJson(r.auth),
        vars: toVars(enabled(r.vars?.req)),
        ...parseAssertions(enabled(r.assertions)),
        seq: Number(item.seq) || index,
      })
    })
  }
  walk(json.items, [], '')
  for (const req of result.requests) applyInheritance(req, collection, folders)

  for (const env of json.environments || []) {
    const parsedEnv = environmentFromJson(env, 'Environment')
    result.environments.push(parsedEnv)
    result.secretVars.push(...parsedEnv.secrets)
  }
  result.secretVars = [...new Set(result.secretVars)]
  return result
}

/** Accepts any mix of .bru files, bruno.json, .env and collection export JSON */
export function parseBrunoInput(files: BrunoFile[]): BrunoImport {
  const exports = files.filter(f => f.path.endsWith('.json') && !f.path.endsWith('bruno.json'))
  const bru = files.filter(f => !exports.includes(f))
  const merged = parseBruFiles(bru)
  for (const file of exports) {
    try {
      const json = JSON.parse(file.text)
      // "Export environment" writes { name, variables: [...] } on its own
      if (!Array.isArray(json?.items) && Array.isArray(json?.variables)) {
        const env = environmentFromJson(json, file.path.split('/').pop()?.replace(/\.json$/, '') || 'Environment')
        merged.environments.push(env)
        merged.secretVars = [...new Set([...merged.secretVars, ...env.secrets])]
        continue
      }
      const part = parseBrunoCollectionJson(json)
      merged.requests.push(...part.requests.map(r => ({ ...r, id: `${file.path}${r.id}` })))
      merged.environments.push(...part.environments)
      Object.assign(merged.collectionVars, part.collectionVars)
      merged.secretVars = [...new Set([...merged.secretVars, ...part.secretVars])]
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

/** Every variable name a request refers to (URL, headers, body, auth) */
export function requestVariables(req: BrunoRequest): string[] {
  const auth = req.auth.mode === 'basic'
    ? [req.auth.username, req.auth.password]
    : req.auth.mode === 'bearer'
      ? [req.auth.token]
      : req.auth.mode === 'apikey'
        ? [req.auth.key, req.auth.value]
        : []
  return unresolvedVariables([req.url, req.body, ...req.headers.flatMap(h => [h.key, h.value]), ...auth].join('\n'))
}

/**
 * Variables for one request, Bruno precedence (lowest first): collection,
 * environment, folder + request vars, then the user's overrides.
 */
export function variablesFor(
  req: BrunoRequest,
  collectionVars: Record<string, string>,
  environment: Record<string, string> | undefined,
  overrides: Record<string, string> = {},
): Record<string, string> {
  const filled = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== ''))
  return { ...collectionVars, ...(environment ?? {}), ...req.vars, ...filled }
}

export function resolveRequest(req: BrunoRequest, vars: Record<string, string>): BrunoRequest {
  const auth: BrunoAuth = req.auth.mode === 'basic'
    ? { ...req.auth, username: interpolate(req.auth.username, vars), password: interpolate(req.auth.password, vars) }
    : req.auth.mode === 'bearer'
      ? { ...req.auth, token: interpolate(req.auth.token, vars) }
      : req.auth.mode === 'apikey'
        ? { ...req.auth, key: interpolate(req.auth.key, vars), value: interpolate(req.auth.value, vars) }
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
  } else if (req.auth.mode === 'apikey' && req.auth.key) {
    if (req.auth.placement === 'queryparams') {
      // Add ?key=value (or &key=value) to the URL
      const sep = req.url.includes('?') ? '&' : '?'
      // Placeholders stay readable so they can be filled later
      const enc = (v: string) => (v.includes('{{') ? v : encodeURIComponent(v))
      req = { ...req, url: `${req.url}${sep}${enc(req.auth.key)}=${enc(req.auth.value)}` }
    } else if (!hasHeader(req.auth.key.toLowerCase())) {
      headers.push({ key: req.auth.key, value: req.auth.value })
    }
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
