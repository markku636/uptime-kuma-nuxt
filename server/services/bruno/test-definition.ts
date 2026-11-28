import { createHmac, timingSafeEqual } from 'node:crypto'
import brunoLang from '@usebruno/lang'
import { prisma } from '../../utils/prisma'
import { decryptSecret, encryptSecret } from '../../utils/variables'
import { parseSelector } from '../../utils/assertions'
import { parseBrunoManifest } from './parser'
import type { BrunoManifest, BrunoParsed, BrunoRequest } from '../../../shared/types/bruno'

const MAX_STEPS = 20
const MAX_EXTRACTIONS = 32
const EXTRACT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export interface TestExtraction { name: string; source: 'status' | 'responseTime' | 'header' | 'json'; path?: string }
export interface TestStep { path: string; name: string; method: string; source: string; extract: TestExtraction[] }
export interface TestDefinition {
  steps: TestStep[]
  failFast: boolean
  timeoutSec: number
  variables: string[]
  secretNames: string[]
}

class Invalid extends Error { constructor(public code: string, public field?: string) { super(code) } }

/** Only a tiny declarative subset of Bruno's post-response vars is executable. */
export function extractRules(source: string): TestExtraction[] {
  let ast: any
  try { ast = brunoLang.bruToJsonV2(source) } catch { throw new Invalid('UNSUPPORTED_EXTRACTION') }
  const pairs = ast?.vars?.res
  if (pairs === undefined) return []
  if (!Array.isArray(pairs) || pairs.length > MAX_EXTRACTIONS) throw new Invalid('EXTRACTION_LIMIT')
  const result: TestExtraction[] = []
  const seen = new Set<string>()
  for (const pair of pairs) {
    if (!pair || typeof pair !== 'object' || Array.isArray(pair)) throw new Invalid('UNSUPPORTED_EXTRACTION')
    const keys = Object.keys(pair)
    if (keys.some(key => !['name', 'value', 'enabled', 'local', 'secret'].includes(key))) throw new Invalid('UNSUPPORTED_EXTRACTION')
    if (pair.enabled === false) continue
    if (typeof pair.name !== 'string' || !EXTRACT_NAME.test(pair.name) || seen.has(pair.name)) throw new Invalid('INVALID_EXTRACTION_NAME')
    if (typeof pair.value !== 'string' || pair.value.length > 256) throw new Invalid('UNSUPPORTED_EXTRACTION')
    const expression = pair.value.trim()
    let rule: TestExtraction
    if (expression === 'res.status') rule = { name: pair.name, source: 'status' }
    else if (expression === 'res.responseTime') rule = { name: pair.name, source: 'responseTime' }
    else {
      const header = /^res\.headers\.([A-Za-z0-9-]{1,128})$/.exec(expression)
      const body = /^res\.body(?:\.([\s\S]+))?$/.exec(expression)
      if (header) rule = { name: pair.name, source: 'header', path: header[1]!.toLowerCase() }
      else if (body) {
        const selector = '$' + (body[1] ? `.${body[1]}` : '')
        try { parseSelector(selector) } catch { throw new Invalid('UNSUPPORTED_EXTRACTION', pair.name) }
        rule = { name: pair.name, source: 'json', path: selector }
      } else throw new Invalid('UNSUPPORTED_EXTRACTION', pair.name)
    }
    seen.add(pair.name)
    result.push(rule)
  }
  return result
}

export function validateExtractionRules(rules: unknown): TestExtraction[] {
  if (!Array.isArray(rules) || rules.length > MAX_EXTRACTIONS) throw new Invalid('EXTRACTION_LIMIT')
  const seen = new Set<string>()
  return rules.map((rule: any) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Invalid('UNSUPPORTED_EXTRACTION')
    if (typeof rule.name !== 'string' || !EXTRACT_NAME.test(rule.name) || seen.has(rule.name)) throw new Invalid('INVALID_EXTRACTION_NAME')
    if (!['status', 'responseTime', 'header', 'json'].includes(rule.source)) throw new Invalid('UNSUPPORTED_EXTRACTION')
    let path: string | undefined
    if (rule.source === 'header') {
      if (typeof rule.path !== 'string' || !/^[A-Za-z0-9-]{1,128}$/.test(rule.path)) throw new Invalid('UNSUPPORTED_EXTRACTION')
      path = rule.path.toLowerCase()
    } else if (rule.source === 'json') {
      if (typeof rule.path !== 'string' || !rule.path.startsWith('$')) throw new Invalid('UNSUPPORTED_EXTRACTION')
      try { parseSelector(rule.path) } catch { throw new Invalid('UNSUPPORTED_EXTRACTION') }
      path = rule.path
    }
    seen.add(rule.name)
    return { name: rule.name, source: rule.source, ...(path ? { path } : {}) } as TestExtraction
  })
}

async function environmentValues(scope: { workspaceId: number; environmentId: number }) {
  const environment = await prisma.environment.findFirst({ where: { id: scope.environmentId, workspaceId: scope.workspaceId } })
  if (!environment) throw createError({ statusCode: 404, message: 'Environment not found' })
  const values: Record<string, string> = { ...((environment.variables || {}) as Record<string, string>) }
  const secretNames = Object.keys(environment.secrets || {})
  for (const name of secretNames) {
    values[name] = decryptSecret(String((environment.secrets as Record<string, string>)[name]), `${scope.workspaceId}:${scope.environmentId}:${name}`)
  }
  return { values, secretNames }
}

function fingerprint(input: unknown) {
  const key = process.env.APP_ENCRYPTION_KEY
  if (!key || !/^[a-f\d]{64}$/i.test(key)) throw new Error('Encryption key unavailable')
  return createHmac('sha256', Buffer.from(key, 'hex')).update(JSON.stringify(input)).digest('hex')
}

export async function prepareTestSuite(
  scope: { workspaceId: number; environmentId: number; user: { id: number }; role: string },
  manifest: BrunoManifest,
  overrides: { variables?: Record<string, string>; secrets?: Record<string, string> } = {},
) {
  const { values, secretNames } = await environmentValues(scope)
  const merged = { ...values, ...(overrides.variables || {}), ...(overrides.secrets || {}) }
  const parsed: BrunoParsed = await parseBrunoManifest(manifest, merged, [...secretNames, ...Object.keys(overrides.secrets || {})])
  const files = new Map(manifest.files.map(file => [file.path, file.content]))
  const issues = [...parsed.issues]
  const steps: TestStep[] = []
  if (!issues.length) {
    if (parsed.requests.length > MAX_STEPS) issues.push({ file: '', code: 'STEP_LIMIT' })
    // A pure test collection must not depend on Bruno post-response scripts for values.
    if (parsed.missingSecrets.length) issues.push({ file: '', code: 'MISSING_VARIABLE' })
    for (const request of parsed.requests.slice(0, MAX_STEPS)) {
      try {
        steps.push({ path: request.path, name: request.name.slice(0, 200), method: String(request.config.method || 'GET').toUpperCase(),
          source: files.get(request.path) || '', extract: extractRules(files.get(request.path) || '') })
      } catch (error: any) {
        issues.push({ file: request.path, code: error instanceof Invalid ? error.code : 'UNSUPPORTED_EXTRACTION', field: error?.field })
      }
    }
  }
  const definition: TestDefinition = {
    steps, failFast: true, timeoutSec: 180,
    variables: Object.keys(parsed.variables), secretNames: [...new Set([...parsed.secrets ? Object.keys(parsed.secrets) : [], ...Object.keys(overrides.secrets || {})])],
  }
  return {
    ok: issues.length === 0,
    issues,
    steps: steps.map(row => ({ path: row.path, name: row.name, method: row.method, extract: row.extract })),
    collectionName: parsed.collectionName || manifest.collectionId,
    missingSecrets: parsed.missingSecrets,
    definition,
    digest: fingerprint({ manifest: { ...manifest, files: [...manifest.files].sort((a, b) => a.path.localeCompare(b.path)) },
      scope: { workspaceId: scope.workspaceId, environmentId: scope.environmentId, userId: scope.user.id },
      overrides, definition }),
  }
}

export function verifyDigest(prepared: Awaited<ReturnType<typeof prepareTestSuite>>, expected: string) {
  if (!/^[a-f\d]{64}$/i.test(expected)) return false
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(prepared.digest, 'hex'))
}

export function sealTestSecrets(workspaceId: number, environmentId: number, collectionId: string, secrets: Record<string, string>) {
  if (!Object.keys(secrets).length) return null
  return encryptSecret(JSON.stringify(secrets), `${workspaceId}:${environmentId}:bruno-test:${collectionId}`)
}

export function unsealTestSecrets(value: string | null, workspaceId: number, environmentId: number, collectionId: string): Record<string, string> {
  if (!value) return {}
  const parsed = JSON.parse(decryptSecret(value, `${workspaceId}:${environmentId}:bruno-test:${collectionId}`))
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export function suiteDTO(row: any) {
  const definition = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition
  return {
    id: row.id, workspaceId: row.workspaceId, environmentId: row.environmentId,
    collectionId: row.collectionId, name: row.name,
    steps: definition?.steps?.length || 0, failFast: !!definition?.failFast, timeoutSec: definition?.timeoutSec || 180,
    secretNames: definition?.secretNames || [], createdAt: row.createdAt, updatedAt: row.updatedAt,
  }
}
