import brunoLang from '@usebruno/lang'
import { parseBrunoManifest } from './parser'
import { validVariableName } from '../../utils/variables'
import type { BrunoIssue, BrunoRequestModel } from '../../../shared/types/bruno'

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const
const UNARY_OPERATORS = new Set(['exists', 'notExists', 'isNull', 'isNotNull', 'isEmpty', 'isNotEmpty', 'isJson', 'isNumber', 'isString', 'isBoolean', 'isArray', 'isDefined', 'isUndefined', 'isTruthy', 'isFalsy'])
const OPERATORS = new Set(['eq', 'ne', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'startsWith', 'endsWith', 'length', 'between', 'matches', 'notMatches', 'contains', 'notContains', ...UNARY_OPERATORS])
const AUTH_MODES = ['none', 'inherit', 'basic', 'bearer']
const BODY_MODES = ['none', 'json', 'text']
const FILE = 'request.bru'

class EditorError extends Error {
  constructor(public code: string, public field?: string) { super(code) }
}
const fail: (code: string, field?: string) => never = (code, field) => { throw new EditorError(code, field) }
const safeIssue = (error: unknown, file = FILE): BrunoIssue => ({
  file,
  code: error instanceof EditorError ? error.code : 'INVALID_SYNTAX',
  ...(error instanceof EditorError && error.field ? { field: error.field } : {}),
})

const asRecord = (value: unknown, field: string): Record<string, any> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_FIELD', field)
  return value as Record<string, any>
}
const asText = (value: unknown, field: string, maximum: number): string => {
  if (typeof value !== 'string' || Buffer.byteLength(value) > maximum) fail('INVALID_FIELD', field)
  return value
}
/** Values written on a single .bru line must not contain control characters. */
const asLine = (value: unknown, field: string, maximum: number): string => {
  const result = asText(value, field, maximum)
  if (/[\r\n\x00-\x1f\x7f]/.test(result)) fail('INVALID_FIELD', field)
  return result
}
const asArray = (value: unknown, field: string, maximum: number): any[] => {
  if (!Array.isArray(value) || value.length > maximum) fail('INVALID_FIELD', field)
  return value
}
const asPairs = (value: unknown, field: string, maximum = 100): Array<{ name: string; value: string; enabled: boolean; type?: 'query' | 'path' }> =>
  asArray(value, field, maximum).map(pair => {
    const row = asRecord(pair, field)
    if (typeof row.enabled !== 'boolean') fail('INVALID_FIELD', `${field}.enabled`)
    const result: { name: string; value: string; enabled: boolean; type?: 'query' | 'path' } = {
      name: asLine(row.name, `${field}.name`, 256),
      value: asLine(row.value, `${field}.value`, 32768),
      enabled: row.enabled,
    }
    if (field === 'params' && row.type !== undefined) {
      if (row.type !== 'query' && row.type !== 'path') fail('UNSUPPORTED_PARAMETER', 'params')
      result.type = row.type
    }
    return result
  })

const manifestFor = (source: string) => ({
  collectionId: 'editor',
  mode: 'create' as const,
  files: [{ path: FILE, content: source }],
})

/**
 * parser.ts intentionally rejects @description annotations, but the official writer emits them and the
 * official parser reads them back. Blank those lines (keeping line numbers) for strict validation only.
 */
function withoutDescriptionAnnotations(source: string): string {
  const output: string[] = []
  let inMultiline = false
  for (const line of source.split(/\r?\n/)) {
    if (inMultiline) {
      if (line.includes("'''")) inMultiline = false
      output.push('')
    } else if (/^\s*@description\s*\(/.test(line)) {
      if ((line.match(/'''/g) || []).length % 2 === 1) inMultiline = true
      output.push('')
    } else output.push(line)
  }
  return output.join('\n')
}

/** Human-readable kinds of Bruno blocks the worker imports but never executes. */
function ignoredBlocks(ast: any): string[] {
  const found: string[] = []
  const text = (value: any) => typeof value === 'string' && value.trim() !== ''
  if (ast.script !== undefined && (text(ast.script?.req) || text(ast.script?.res))) found.push('script')
  if (ast.tests !== undefined && text(ast.tests)) found.push('tests')
  if (Array.isArray(ast.vars?.res) && ast.vars.res.some((pair: any) => pair?.enabled)) found.push('post-response vars')
  if (ast.settings !== undefined) {
    // Mirror parser.ts: only settings that change behaviour count as ignored.
    const { encodeUrl = true, timeout = 0, ...rest } = ast.settings || {}
    if (encodeUrl !== true || Number(timeout) > 0 || Object.keys(rest).length) found.push('settings')
  }
  return found
}

/** Raw top-level blocks that the worker strips but the editor keeps so a UI save is lossless. */
function ignoredSources(source: string): string[] {
  const pattern = /^[ \t]*(script:pre-request|script:post-response|tests|vars:post-response|settings)[ \t]*\{[ \t]*\r?\n[\s\S]*?\r?\n[ \t]*\}/gm
  return [...source.matchAll(pattern)].map(match => match[0])
}

/**
 * Validates one declarative .bru request and exposes a UI-friendly model.
 * Variable references stay as `{{name}}`; environment/secrets values are only used to make the
 * strict parser accept (and safely ignore) opaque references, never to expand them here.
 */
export async function sourceToModel(
  source: string,
  values: Record<string, string> = {},
  secretNames: string[] = [],
): Promise<{ model: BrunoRequestModel | null; issues: BrunoIssue[] }> {
  const parsed = await parseBrunoManifest(manifestFor(withoutDescriptionAnnotations(source)), values, secretNames)
  if (parsed.issues.length) return { model: null, issues: parsed.issues }
  if (parsed.requests.length !== 1) return { model: null, issues: [{ file: '', code: 'REQUEST_COUNT' }] }

  // parser.ts normalizes config (and loses the raw assertion operator syntax), so read the official AST too.
  let ast: any
  try { ast = brunoLang.bruToJsonV2(source) } catch { return { model: null, issues: [{ file: FILE, code: 'INVALID_SYNTAX' }] } }

  try {
    const method = String(ast.http?.method || 'get').toUpperCase()
    if (!METHODS.includes(method as (typeof METHODS)[number])) fail('UNSUPPORTED_METHOD', 'http.method')

    const name = typeof ast.meta?.name === 'string' && ast.meta.name.trim() ? ast.meta.name.slice(0, 150) : 'request'
    const rawParams: any[] = Array.isArray(ast.params) ? ast.params : []
    // Bruno duplicates enabled query params in the URL; params are authoritative, so drop the URL copy.
    const hasQuery = rawParams.some(pair => pair && typeof pair === 'object' && pair.type !== 'path')
    const rawUrl = asLine(ast.http?.url, 'http.url', 8192)
    const url = hasQuery ? rawUrl.replace(/\?[^#]*/, '') : rawUrl

    const params = rawParams
      .filter(pair => pair && typeof pair === 'object')
      .map(pair => ({ name: String(pair.name ?? ''), value: String(pair.value ?? ''), enabled: pair.enabled !== false, ...(pair.type === 'path' ? {type: 'path' as const} : {}) }))
    const headerRows: any[] = Array.isArray(ast.headers) ? ast.headers : []
    const headers = headerRows
      .filter(pair => pair && typeof pair === 'object')
      .map(pair => ({ name: String(pair.name ?? ''), value: String(pair.value ?? ''), enabled: pair.enabled !== false }))
    const varRows: any[] = Array.isArray(ast.vars?.req) ? ast.vars.req : []
    const vars = varRows
      .filter(pair => pair && typeof pair === 'object')
      .map(pair => ({ name: String(pair.name ?? ''), value: String(pair.value ?? ''), enabled: pair.enabled !== false }))

    let auth: BrunoRequestModel['auth']
    if (ast.http?.auth === 'basic') auth = { mode: 'basic', username: String(ast.auth?.basic?.username ?? ''), password: String(ast.auth?.basic?.password ?? '') }
    else if (ast.http?.auth === 'bearer') auth = { mode: 'bearer', token: String(ast.auth?.bearer?.token ?? '') }
    else if (ast.http?.auth === 'inherit') auth = { mode: 'inherit' }
    else auth = { mode: 'none' }

    const bodyMode = ast.http?.body || 'none'
    const body: BrunoRequestModel['body'] = {
      mode: BODY_MODES.includes(bodyMode) ? bodyMode as BrunoRequestModel['body']['mode'] : 'none',
      content: bodyMode !== 'none' ? String(ast.body?.[bodyMode] ?? '') : '',
    }

    const assertionRows: any[] = Array.isArray(ast.assertions) ? ast.assertions : []
    const assertions: BrunoRequestModel['assertions'] = assertionRows
      .filter(pair => pair && typeof pair === 'object')
      .map(pair => {
        const raw = String(pair.value ?? '').trim()
        const match = /^(\S+)(?:\s+([\s\S]+))?$/.exec(raw)
        const candidate = match?.[1] || ''
        const isOperator = OPERATORS.has(candidate)
        const operator = isOperator ? candidate : 'eq'
        const value = isOperator ? (UNARY_OPERATORS.has(candidate) ? '' : match?.[2] ?? '') : raw
        const assertion: BrunoRequestModel['assertions'][number] = {
          expression: String(pair.name ?? ''), operator, value, enabled: pair.enabled !== false,
        }
        const annotated = Array.isArray(pair.annotations)
          ? pair.annotations.find((item: any) => item?.name === 'description')?.value
          : undefined
        const description = typeof pair.description === 'string' ? pair.description : annotated
        if (typeof description === 'string' && description) assertion.description = description
        return assertion
      })

    const docs = typeof ast.docs === 'string' && ast.docs.trim() ? ast.docs : undefined
    const rawIgnored = ignoredSources(source)
    const model: BrunoRequestModel = {
      name, method: method as BrunoRequestModel['method'], url, params, headers, auth, body, vars, assertions,
      ignoredBlocks: ignoredBlocks(ast), ...(docs ? {docs} : {}),
      ...(rawIgnored.length ? {ignoredSources: rawIgnored} : {}),
    }
    return { model, issues: [] }
  } catch (error) {
    return { model: null, issues: [safeIssue(error)] }
  }
}

/** Encode literal query text while leaving {{variable}} placeholders usable by the resolver. */
function encodeQueryPart(value: string): string {
  return value.split(/(\{\{\s*[^{}]+?\s*\}\})/g)
    .map(part => /^\{\{/.test(part) ? part : encodeURIComponent(part))
    .join('')
}

/**
 * Turns a UI model back into official .bru text and re-validates it through the strict parser.
 * The validation copy omits assertion descriptions because parser.ts deliberately rejects annotations;
 * the returned source still contains them and the official parser reads them back correctly.
 */
export async function modelToSource(
  model: BrunoRequestModel,
  values: Record<string, string> = {},
  secretNames: string[] = [],
): Promise<{ source: string | null; issues: BrunoIssue[] }> {
  let json: any
  try {
    const input = asRecord(model, 'model')
    const name = asLine(input.name, 'name', 150).trim()
    const method = asLine(input.method, 'method', 16).toUpperCase()
    if (!METHODS.includes(method as (typeof METHODS)[number])) fail('UNSUPPORTED_METHOD', 'method')
    const rawUrl = asLine(input.url, 'url', 8192)

    const params = asPairs(input.params, 'params').map(pair => ({ ...pair, type: pair.type || 'query' as const }))
    const headers = asPairs(input.headers, 'headers')
    const authInput = asRecord(input.auth, 'auth')
    const authMode = asLine(authInput.mode, 'auth.mode', 16)
    if (!AUTH_MODES.includes(authMode)) fail('UNSUPPORTED_AUTH', 'auth.mode')
    const bodyInput = asRecord(input.body, 'body')
    const bodyMode = asLine(bodyInput.mode, 'body.mode', 16)
    if (!BODY_MODES.includes(bodyMode)) fail('UNSUPPORTED_BODY', 'body.mode')
    const content = asText(bodyInput.content, 'body.content', 131072)
    const vars = asPairs(input.vars, 'vars', 200)
    for (const pair of vars) if (pair.enabled && !validVariableName(pair.name)) fail('INVALID_VARIABLES', 'vars')

    const assertions = asArray(input.assertions, 'assertions', 50).map(pair => {
      const row = asRecord(pair, 'assertions')
      if (typeof row.enabled !== 'boolean') fail('INVALID_FIELD', 'assertions.enabled')
      const operator = asLine(row.operator, 'assertions.operator', 32)
      if (!OPERATORS.has(operator)) fail('UNSUPPORTED_ASSERTION', 'assertions')
      const expression = asLine(row.expression, 'assertions.expression', 256)
      const value = asLine(row.value, 'assertions.value', 4096)
      if (!UNARY_OPERATORS.has(operator) && !value) fail('UNSUPPORTED_ASSERTION', 'assertions')
      const assertion: Record<string, any> = {
        name: expression,
        value: UNARY_OPERATORS.has(operator) ? operator : `${operator} ${value}`,
        enabled: row.enabled,
      }
      if (row.description !== undefined && row.description !== null) {
        const description = asLine(row.description, 'assertions.description', 500)
          .replace(/[\r\n]+/g, ' ')
          .replace(/'''/g, '')
          .trim()
        if (description) assertion.description = description
      }
      return assertion
    })

    // A path param without its :name token in the URL would be silently ignored by the worker.
    for (const pair of params) {
      if (pair.enabled && pair.type === 'path' && !rawUrl.includes(`:${pair.name}`)) fail('UNSUPPORTED_PARAMETER', 'params')
    }
    // Params are authoritative: rebuild the URL query from enabled params only, never duplicate one.
    const enabled = params.filter(pair => pair.enabled && pair.type !== 'path')
    let url = rawUrl
    if (enabled.length) {
      const hashAt = rawUrl.indexOf('#')
      const fragment = hashAt >= 0 ? rawUrl.slice(hashAt) : ''
      const base = (hashAt >= 0 ? rawUrl.slice(0, hashAt) : rawUrl).split('?')[0]!
      url = `${base}?${enabled.map(pair => `${encodeQueryPart(pair.name)}=${encodeQueryPart(pair.value)}`).join('&')}${fragment}`
    }

    json = {
      meta: { name: name || 'request', type: 'http', seq: 1 },
      http: { method: method.toLowerCase(), url, body: bodyMode, auth: authMode },
      params,
      // Basic/bearer credentials live only in the auth block; an Authorization header would be ambiguous.
      headers: authMode === 'basic' || authMode === 'bearer'
        ? headers.filter(header => header.name.toLowerCase() !== 'authorization')
        : headers,
      assertions,
    }
    if (authMode === 'basic') {
      json.auth = { basic: { username: asLine(authInput.username, 'auth.username', 8192), password: asLine(authInput.password, 'auth.password', 8192) } }
    } else if (authMode === 'bearer') {
      json.auth = { bearer: { token: asLine(authInput.token, 'auth.token', 8192) } }
    }
    if (bodyMode !== 'none') json.body = { [bodyMode]: content }
    if (input.docs !== undefined && input.docs !== null) {
      const docs = asText(input.docs, 'docs', 32768)
      if (docs.trim()) json.docs = docs
    }
    if (vars.length) json.vars = { req: vars.map(pair => ({ ...pair, local: false })) }
  } catch (error) {
    return { source: null, issues: [safeIssue(error)] }
  }

  let source: string
  try {
    source = brunoLang.jsonToBruV2(json)
    for (const block of asArray(model.ignoredSources ?? [], 'ignoredSources', 10)) {
      const text = asText(block, 'ignoredSources', 65536).trim()
      if (!/^(script:pre-request|script:post-response|tests|vars:post-response|settings)\s*\{/.test(text)) fail('UNSUPPORTED_BLOCK', 'ignoredSources')
      source += `\n\n${text}`
    }
    if (Buffer.byteLength(source) > 131072) fail('FILE_TOO_LARGE')
  } catch (error) {
    return { source: null, issues: [safeIssue(error)] }
  }

  const hasAnnotations = (json.assertions || []).some((assertion: any) => assertion.description || assertion.annotations)
  const validationSource = hasAnnotations
    ? brunoLang.jsonToBruV2({
      ...json,
      assertions: (json.assertions || []).map((assertion: any) => {
        const { description: _description, annotations: _annotations, ...rest } = assertion
        return rest
      }),
    })
    : source
  const parsed = await parseBrunoManifest(manifestFor(validationSource), values, secretNames)
  if (parsed.issues.length) return { source: null, issues: parsed.issues }
  return { source, issues: [] }
}

/** Loads opaque environment values for the strict parser; secrets are decrypted server-side only. */
export async function editorEnvironmentValues(workspaceId: number, environmentId: number) {
  const { prisma } = await import('../../utils/prisma')
  const { decryptSecret } = await import('../../utils/variables')
  const environment = await prisma.environment.findFirst({ where: { id: environmentId, workspaceId } })
  if (!environment) throw Object.assign(new Error('Environment not found'), { statusCode: 404 })
  const storedSecrets = (environment.secrets || {}) as Record<string, string>
  const secretNames = Object.keys(storedSecrets)
  const values: Record<string, string> = {}
  for (const [name, value] of Object.entries((environment.variables || {}) as Record<string, string>)) values[name] = value
  for (const name of secretNames) values[name] = decryptSecret(storedSecrets[name]!, `${workspaceId}:${environmentId}:${name}`)
  return { values, secretNames }
}
