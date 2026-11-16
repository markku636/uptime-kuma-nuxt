// Generates the Bruno collection in ./bruno from the API catalogue
// (server/openapi/spec.ts). Run with: npm run bruno:generate
//
// Tag folders are deleted and rewritten on every run — do not hand-edit them.
// Environments are only created when missing, so local edits survive.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { API_TAGS, DEFAULT_VARS, ENDPOINTS, acceptsApiKey } from '../server/openapi/spec.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'bruno')

const indent = (text, n = 2) => text.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n')
const block = (name, body) => `${name} {\n${indent(body)}\n}\n`
const fileName = name => name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content.replace(/\n+$/, '\n'), 'utf8')
}

/** Safe to run unattended: read-only, needs no existing record. */
const isSmoke = e => e.path === '/api/auth/login'
  || (e.method === 'get' && !e.destructive && !e.params && e.tag !== 'Cloudflared')

function requestFile(e, { name, zh, body, seq }) {
  const tags = [e.destructive ? 'destructive' : null, isSmoke(e) ? 'smoke' : null].filter(Boolean)
  const meta = [`name: ${name}`, 'type: http', `seq: ${seq}`]
  if (tags.length) meta.push(`tags: [\n${indent(tags.join('\n'))}\n]`)

  const enabledQuery = (e.query ?? []).filter(q => q.enabled)
  const qs = enabledQuery.map(q => `${q.name}=${q.example ?? ''}`).join('&')
  const url = `{{baseUrl}}${e.path.replace(/\{(\w+)\}/g, ':$1')}${qs ? `?${qs}` : ''}`
  const bodyMode = body !== undefined ? 'json' : e.multipart ? 'multipartForm' : 'none'

  const parts = [
    block('meta', meta.join('\n')),
    block(e.method, [`url: ${url}`, `body: ${bodyMode}`, 'auth: none'].join('\n')),
  ]

  if (e.query?.length) {
    parts.push(block('params:query', e.query
      .map(q => `${q.enabled ? '' : '~'}${q.name}: ${q.example ?? ''}`).join('\n')))
  }

  const pathParams = [...e.path.matchAll(/\{(\w+)\}/g)].map(m => m[1])
  if (pathParams.length) {
    parts.push(block('params:path', pathParams.map(p => `${p}: {{${e.params?.[p] ?? p}}}`).join('\n')))
  }

  if (body !== undefined) {
    parts.push(block('body:json', JSON.stringify(body, null, 2)))
  }
  else if (e.multipart) {
    parts.push(block('body:multipart-form', Object.entries(e.multipart)
      .map(([k, kind]) => `${k}: ${kind === 'file' ? '@file()' : ''}`).join('\n')))
  }

  if (isSmoke(e)) parts.push(block('assert', 'res.status: eq 200'))

  if (e.capture) {
    const { var: v, field } = e.capture
    parts.push(block('script:post-response', [
      'const body = res.getBody();',
      `const value = body?.data?.${field} ?? body?.${field};`,
      'if (value !== undefined && value !== null) {',
      `  bru.setVar("${v}", value);`,
      '}',
    ].join('\n')))
  }

  const docs = [
    zh,
    e.description,
    e.public
      ? 'Public — no login required.'
      : acceptsApiKey(e.path)
        ? 'Requires the session cookie from **Auth / Login**, or the `apiKey` environment secret.'
        : 'Requires the session cookie from **Auth / Login** (API keys are not accepted here).',
    e.destructive ? '**Destructive** — excluded from smoke runs.' : null,
    e.capture ? `Stores the new record in \`{{${e.capture.var}}}\` for the following requests.` : null,
  ].filter(Boolean).join('\n\n')
  parts.push(block('docs', docs))

  return parts.join('\n')
}

// ── collection root ──────────────────────────────────────────────────────
write(join(outDir, 'bruno.json'), `${JSON.stringify({
  version: '1',
  name: 'Uptime Kuma Nuxt API',
  type: 'collection',
  ignore: ['node_modules', '.git'],
}, null, 2)}\n`)

const COLLECTION_PRE_REQUEST = [
  '// Send the apiKey environment secret on /api/v1/* (except key management) when it is set.',
  '// Leave apiKey empty to use the session cookie from Auth / Login instead.',
  'const apiKey = bru.getEnvVar("apiKey");',
  'const url = req.getUrl();',
  'if (apiKey && url.includes("/api/v1/") && !url.includes("/api/v1/api-keys")) {',
  '  req.setHeader("X-API-Key", apiKey);',
  '}',
].join('\n')

write(join(outDir, 'collection.bru'), `${block('script:pre-request', COLLECTION_PRE_REQUEST)}\n${block('docs', [
  '# Uptime Kuma Nuxt API',
  '',
  'Generated from `server/openapi/spec.ts` — run `npm run bruno:generate` after changing the API.',
  '',
  '1. Select the **Local** environment.',
  '2. Authenticate, either:',
  '   - set the `password` secret and run **Auth / Login** — Bruno keeps the `nuxt-session` cookie, or',
  '   - set the `apiKey` secret (Settings → API Keys, `uk_...`) — sent as `X-API-Key` on `/api/v1/*`.',
  '     Auth, settings and API-key endpoints outside that scope still need the login cookie.',
  '3. "Create ..." requests store the new id in a variable (`monitorId`, `tagId`, ...) that the',
  '   get / update / delete requests of the same folder use.',
  '',
  'Smoke run (read-only): `bru run --env Local --tags smoke`',
].join('\n'))}`)

const envFile = join(outDir, 'environments', 'Local.bru')
if (!existsSync(envFile)) {
  const vars = {
    baseUrl: 'http://localhost:32400',
    node1Url: 'http://localhost:32411',
    node2Url: 'http://localhost:32412',
    node3Url: 'http://localhost:32413',
    username: 'admin',
    ...DEFAULT_VARS,
  }
  write(envFile, [
    block('vars', Object.entries(vars).map(([k, v]) => `${k}: ${v}`).join('\n')),
    'vars:secret [\n  password,\n  apiKey\n]\n',
  ].join(''))
}
else {
  // Older environments: add the apiKey secret without touching the user's values
  const env = readFileSync(envFile, 'utf8')
  if (!/vars:secret \[[^\]]*\bapiKey\b/.test(env)) {
    writeFileSync(envFile, env.replace(/vars:secret \[([^\]]*?)\s*\]/, (_, list) => `vars:secret [${list.trimEnd()},\n  apiKey\n]`), 'utf8')
  }
}

// ── folders and requests ─────────────────────────────────────────────────
let count = 0
API_TAGS.forEach((tag, tagIndex) => {
  const dir = join(outDir, fileName(tag.name))
  rmSync(dir, { recursive: true, force: true })
  write(join(dir, 'folder.bru'), [
    block('meta', `name: ${tag.name}\nseq: ${tagIndex + 1}`),
    block('docs', tag.description),
  ].join('\n'))

  let seq = 0
  const emit = (e, name, zh, body) => {
    seq += 1
    count += 1
    write(join(dir, `${fileName(name)}.bru`), requestFile(e, { name, zh, body, seq }))
  }

  for (const e of ENDPOINTS.filter(x => x.tag === tag.name)) {
    emit(e, e.summary, e.zh, e.body)
    for (const ex of e.examples ?? []) emit(e, ex.name, ex.zh, ex.body)
  }

  // Direct node access only makes sense in an API client, not in the OpenAPI document
  if (tag.name === 'Cluster') {
    for (const n of [1, 2, 3]) {
      seq += 1
      count += 1
      write(join(dir, `Health check - node ${n} direct.bru`), [
        block('meta', `name: Health check - node ${n} direct\ntype: http\nseq: ${seq}`),
        block('get', `url: {{node${n}Url}}/api/health\nbody: none\nauth: none`),
        block('docs', `直接存取 Node ${n} (繞過 nginx)。Check the \`X-Served-By\` header.`),
      ].join('\n'))
    }
  }
})

console.log(`Bruno collection written to ${outDir} (${count} requests)`)
