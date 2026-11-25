import brunoLang from '@usebruno/lang'
import {hydrateMonitor} from '../../utils/monitor-secrets'
import {validVariableName} from '../../utils/variables'
import {BrunoExportError,assertionPair,monitorAssertionRules} from './exporter'

/**
 * Exports monitors as a Bruno collection, following Bruno's own conventions:
 * request content stays as stored (including {{variables}}), environment variables keep
 * their values and secrets are written by name only. Literal credentials found in a
 * request (bearer token, basic password, auth-like headers) become secret variables.
 * Files are produced with the official @usebruno/lang writers.
 */
const METHODS = new Set(['get', 'head', 'post', 'put', 'patch', 'delete', 'options'])
const CREDENTIAL_HEADERS = new Set(['authorization', 'cookie', 'x-api-key', 'api-key', 'apikey', 'x-auth-token', 'x-access-token'])
const RESERVED_NAMES = new Set(['environments', 'bruno.json', 'collection.bru', 'folder.bru', 'uptime-export.json'])

export interface ExportGroup {id: number; parentId: number | null; name: string; sortOrder: number}
export interface ExportEnvironment {name: string; variables: Record<string, string>; secretNames: string[]}
export interface SkippedMonitor {id: number; name: string; reason: string}

/** File-system safe name that also survives the importer's path checks. */
export function safeFileName(value: string, fallback: string) {
  const name = value.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '-').replace(/\s+/g, ' ').trim().replace(/^[. ]+|[. ]+$/g, '').slice(0, 100)
  return name && !RESERVED_NAMES.has(name.toLowerCase()) ? name : fallback
}

function uniqueName(taken: Set<string>, base: string, extension = '') {
  let name = base + extension
  for (let index = 2; taken.has(name.toLowerCase()); index++) name = `${base} (${index})${extension}`
  taken.add(name.toLowerCase())
  return name
}

function variableSlug(value: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  return /^[a-z]/.test(slug) ? slug : `monitor_${slug}`
}

const hasReference = (value: string) => /\{\{\s*[^{}]+\s*\}\}/.test(value)

class SecretNamer {
  readonly names = new Set<string>()
  constructor(private readonly reserved: Set<string>) {}
  /** Keeps {{references}} as they are; replaces a literal credential with a new secret variable. */
  protect(value: string, monitorName: string, field: string) {
    if (!value || hasReference(value)) return value
    let name = `${variableSlug(monitorName)}_${field}`
    for (let index = 2; this.names.has(name) || this.reserved.has(name) || !validVariableName(name); index++) name = `${variableSlug(monitorName)}_${field}_${index}`
    this.names.add(name)
    return `{{${name}}}`
  }
}

function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function monitorDocs(monitor: any) {
  const settings = [`checks every ${monitor.interval ?? 60}s`, `timeout ${monitor.timeout ?? 30}s`]
  if (monitor.maxretries) settings.push(`${monitor.maxretries} retries`)
  if (monitor.ignoreTls) settings.push('TLS verification off')
  if (monitor.upsideDown) settings.push('upside-down mode')
  if ((monitor.maxRedirects ?? 10) !== 10) settings.push(`max ${monitor.maxRedirects} redirects`)
  return `Exported from SealWatch monitor #${monitor.id}: ${settings.join(', ')}.`
}

/** One request as .bru text; throws BrunoExportError when the monitor cannot be expressed in Bruno. */
export function monitorToBru(stored: any, seq: number, secrets: SecretNamer): string {
  const monitor = hydrateMonitor(stored), id = monitor.id
  const fail = (code: string): never => { throw new BrunoExportError(id, code) }
  // Bruno monitors already store a declarative .bru request; export it verbatim.
  if (monitor.type === 'bruno') {
    const source = typeof monitor.body === 'string' ? monitor.body : ''
    if (!source.trim() || Buffer.byteLength(source) > 131072) fail('UNSUPPORTED_MONITOR_TYPE')
    return source.endsWith('\n') ? source : `${source}\n`
  }
  if (!['http', 'keyword', 'json-query'].includes(monitor.type) || !monitor.url) fail('UNSUPPORTED_MONITOR_TYPE')
  const method = String(monitor.method || 'GET').toLowerCase()
  if (!METHODS.has(method)) fail('UNSUPPORTED_METHOD')
  if (monitor.authMethod && !['none', 'basic'].includes(monitor.authMethod)) fail('UNSUPPORTED_AUTH')

  const headers: {name: string; value: string; enabled: boolean}[] = []
  let authMode = 'none', bearerToken = ''
  for (const [name, raw] of Object.entries((monitor.headers || {}) as Record<string, string>)) {
    const value = String(raw), lower = name.toLowerCase()
    if (lower === 'authorization' && monitor.authMethod === 'basic') continue
    const bearer = lower === 'authorization' && /^Bearer\s+(.+)$/i.exec(value)
    if (bearer && monitor.authMethod !== 'basic') { authMode = 'bearer'; bearerToken = secrets.protect(bearer[1]!, monitor.name, 'token'); continue }
    headers.push({name, value: CREDENTIAL_HEADERS.has(lower) ? secrets.protect(value, monitor.name, variableSlug(lower)) : value, enabled: true})
  }

  const params = (monitor.queryParams || []).map((pair: any) => ({name: String(pair.name), value: String(pair.value), enabled: true, type: 'query'}))
  // Bruno keeps enabled query params in the URL as well as in params:query.
  const url = params.length && !String(monitor.url).includes('?')
    ? `${monitor.url}?${params.map((pair: any) => `${pair.name}=${pair.value}`).join('&')}`
    : String(monitor.url)

  const json: any = {
    meta: {name: singleLine(monitor.name) || `Monitor ${id}`, type: 'http', seq},
    http: {method, url, body: 'none', auth: 'none'},
    params, headers,
    assertions: monitorAssertionRules(monitor, fail).map(rule => ({...assertionPair(rule), enabled: true})),
    docs: monitorDocs(monitor),
  }
  if (monitor.authMethod === 'basic') {
    json.http.auth = 'basic'
    json.auth = {basic: {username: monitor.basicAuthUser || '', password: secrets.protect(monitor.basicAuthPass || '', monitor.name, 'password')}}
  } else if (authMode === 'bearer') {
    json.http.auth = 'bearer'
    json.auth = {bearer: {token: bearerToken}}
  }
  if (monitor.body) {
    const contentType = headers.find(header => header.name.toLowerCase() === 'content-type')?.value || ''
    const mode = /json/i.test(contentType) || (!contentType && /^\s*[\[{]/.test(monitor.body)) ? 'json' : 'text'
    json.http.body = mode
    json.body = {[mode]: monitor.body}
  }
  return brunoLang.jsonToBruV2(json)
}

export interface CollectionExportInput {
  collectionName: string
  monitors: any[]
  groups: ExportGroup[]
  /** Group exported as the collection root; null exports from the workspace root. */
  rootGroupId: number | null
  environment: ExportEnvironment
}

/** Builds every file of a Bruno collection (paths relative to the collection directory). */
export function buildBrunoCollection(input: CollectionExportInput) {
  const reserved = new Set([...Object.keys(input.environment.variables), ...input.environment.secretNames])
  const secrets = new SecretNamer(reserved)
  const files: {path: string; content: string}[] = []
  const skipped: SkippedMonitor[] = []
  const byId = new Map(input.groups.map(group => [group.id, group]))
  const children = new Map<number | null, ExportGroup[]>()
  for (const group of input.groups) children.set(group.parentId, [...(children.get(group.parentId) || []), group])

  // Folder path for each group below the export root, named after the group.
  const folderOf = new Map<number | null, string>([[input.rootGroupId, '']])
  const takenIn = new Map<string, Set<string>>()
  const taken = (folder: string) => takenIn.get(folder) || takenIn.set(folder, new Set()).get(folder)!
  const order = (groups: ExportGroup[]) => [...groups].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id - b.id)
  const walk = (parentId: number | null, parentFolder: string) => {
    order(children.get(parentId) || []).forEach((group, index) => {
      const name = uniqueName(taken(parentFolder), safeFileName(group.name, `group-${group.id}`))
      const folder = parentFolder ? `${parentFolder}/${name}` : name
      folderOf.set(group.id, folder)
      files.push({path: `${folder}/folder.bru`, content: brunoLang.jsonToCollectionBru({meta: {name: singleLine(group.name), seq: index + 1}}, true)})
      walk(group.id, folder)
    })
  }
  walk(input.rootGroupId, '')

  const seqIn = new Map<string, number>()
  const used = new Set<string>()
  const monitors = [...input.monitors].sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id - b.id)
  for (const monitor of monitors) {
    // A monitor outside the exported subtree (or ungrouped) lands at the collection root.
    let folder = folderOf.get(monitor.groupId ?? null)
    if (folder === undefined) folder = ''
    const seq = (seqIn.get(folder) || 0) + 1
    try {
      const content = monitorToBru(monitor, seq, secrets)
      const file = uniqueName(taken(folder), safeFileName(monitor.name, `monitor-${monitor.id}`), '.bru')
      seqIn.set(folder, seq)
      files.push({path: folder ? `${folder}/${file}` : file, content})
      used.add(folder)
    } catch (error) {
      if (!(error instanceof BrunoExportError)) throw error
      skipped.push({id: monitor.id, name: monitor.name, reason: error.code})
    }
  }
  // Drop folder.bru files for folders that ended up without requests below them.
  const kept = files.filter(file => !file.path.endsWith('/folder.bru') || [...used].some(folder => folder === file.path.slice(0, -11) || folder.startsWith(file.path.slice(0, -10))))

  const environmentFile = safeFileName(input.environment.name, 'default')
  const variables = [
    ...Object.entries(input.environment.variables).filter(([name]) => validVariableName(name)).map(([name, value]) => ({name, value: String(value), enabled: true, secret: false})),
    ...[...input.environment.secretNames, ...secrets.names].map(name => ({name, value: '', enabled: true, secret: true})),
  ]
  return {
    files: [
      {path: 'bruno.json', content: JSON.stringify({version: '1', name: input.collectionName, type: 'collection', ignore: ['node_modules', '.git']}, null, 2) + '\n'},
      ...(variables.length ? [{path: `environments/${environmentFile}.bru`, content: brunoLang.envJsonToBruV2({variables})}] : []),
      ...kept,
    ],
    exported: files.filter(file => !file.path.endsWith('folder.bru')).length,
    skipped,
    secretNames: [...secrets.names],
    environmentFile: variables.length ? `environments/${environmentFile}.bru` : null,
  }
}

/** Single request download: the .bru text plus the secret names it introduced. */
export function exportSingleRequest(monitor: any, environment: ExportEnvironment) {
  const secrets = new SecretNamer(new Set([...Object.keys(environment.variables), ...environment.secretNames]))
  return {content: monitorToBru(monitor, 1, secrets), secretNames: [...secrets.names]}
}
