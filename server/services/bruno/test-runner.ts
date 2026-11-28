import { prisma } from '../../utils/prisma'
import { decryptSecret } from '../../utils/variables'
import { parseBrunoManifest } from './parser'
import { evaluateAssertions } from '../../utils/assertions'
import { resolveVariables } from '../../utils/variables'
import { executeHttpRequest, HttpCheckError } from '../monitor/checkers/http-request'
import { extractTestVariables } from './test-variables'
import { unsealTestSecrets, type TestDefinition } from './test-definition'

const STALE_MS = 10 * 60_000
const STEP_LIMIT_MS = 10_000
const SENSITIVE = /(token|secret|password|authorization|cookie|api[-_]?key|session)/i
const empty = { version: 1, mode: 'all', rules: [] } as const

function acceptedStatus(status: number, input: unknown) {
  if (input === null || input === undefined || Array.isArray(input) && !input.length) return status >= 200 && status < 400
  if (!Array.isArray(input)) return false
  return input.some(value => {
    const match = /^(\d{3})(?:-(\d{3}))?$/.exec(String(value))
    if (!match) return false
    const min = Number(match[1]), max = Number(match[2] || match[1])
    return status >= min && status <= max
  })
}

function resolveStepConfig(input: any, values: Record<string, string>) {
  const config = { ...input }
  for (const key of ['url', 'body', 'basicAuthUser', 'basicAuthPass']) {
    if (typeof config[key] === 'string') config[key] = resolveVariables(config[key], values)
  }
  if (config.headers && typeof config.headers === 'object') {
    config.headers = Object.fromEntries(Object.entries(config.headers).map(([name, value]) =>
      [name, typeof value === 'string' ? resolveVariables(value, values) : value]))
  }
  if (config.queryParams?.length) {
    const url = new URL(config.url)
    for (const pair of config.queryParams) url.searchParams.append(resolveVariables(pair.name, values), resolveVariables(pair.value, values))
    config.url = url.toString()
  }
  return config
}

function clampActual(value: unknown): unknown {
  if (value === null || value === undefined) return value
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return Buffer.byteLength(text) > 256 ? `${text.slice(0, 256)}…` : text
}

function sanitizeRules(rules: any[]) {
  return rules.map(rule => {
    const sensitive = SENSITIVE.test(String(rule.path || '')) || (rule.source === 'header' && SENSITIVE.test(String(rule.path || '')))
    return {
      ruleId: String(rule.ruleId || ''), source: rule.source, operator: rule.operator,
      passed: !!rule.passed, reason: rule.reason,
      ...(!sensitive && rule.actual !== undefined ? { actual: clampActual(rule.actual) } : {}),
    }
  }).slice(0, 50)
}

async function runValues(scope: { workspaceId: number; environmentId: number }, suite: any) {
  const environment = await prisma.environment.findFirst({ where: { id: scope.environmentId, workspaceId: scope.workspaceId } })
  const values: Record<string, string> = { ...((environment?.variables || {}) as Record<string, string>) }
  const secretNames: string[] = []
  for (const [name, value] of Object.entries((environment?.secrets || {}) as Record<string, string>)) {
    values[name] = decryptSecret(String(value), `${scope.workspaceId}:${scope.environmentId}:${name}`)
    secretNames.push(name)
  }
  const suiteSecrets = unsealTestSecrets(suite.testSecrets, scope.workspaceId, scope.environmentId, suite.collectionId)
  Object.assign(values, suiteSecrets)
  secretNames.push(...Object.keys(suiteSecrets))
  return { values, secretNames: [...new Set(secretNames)] }
}

/** Runs one suite on demand. The partial unique index is the cross-pod single-flight guard. */
export async function runBrunoTestSuite(scope: { workspaceId: number; environmentId: number; user: { id: number } }, suiteId: number) {
  const suite = await prisma.brunoTestSuite.findFirst({
    where: { id: suiteId, workspaceId: scope.workspaceId, environmentId: scope.environmentId },
  })
  if (!suite) throw createError({ statusCode: 404, message: 'Bruno test suite not found' })

  await prisma.brunoTestRun.updateMany({
    where: { suiteId, status: 'running', startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: 'error', finishedAt: new Date(), summary: { error: 'STALE_RUN' } },
  })
  let run: any
  try {
    run = await prisma.brunoTestRun.create({
      data: { workspaceId: scope.workspaceId, suiteId, status: 'running', triggeredBy: scope.user.id, summary: {} },
    })
  } catch (error: any) {
    if (error?.code === 'P2002') throw createError({ statusCode: 409, message: 'This test suite is already running' })
    throw error
  }

  const definition: TestDefinition = typeof suite.definition === 'string' ? JSON.parse(suite.definition) : suite.definition
  const budget = Math.min(180, Math.max(30, Number(definition.timeoutSec) || 180)) * 1000
  const started = Date.now()
  const { values, secretNames } = await runValues(scope, suite)
  const runtime: Record<string, string | null> = {}
  const results: any[] = []
  let overall: 'pass' | 'fail' | 'error' = 'pass'

  const steps = definition.steps || []
  const allExtractNames = [...new Set(steps.flatMap((step: any) => (step.extract || []).map((rule: any) => rule.name)))]
  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]!
    if (Date.now() - started >= budget) {
      overall = 'error'
      results.push({ stepIndex: index, path: step.path, name: step.name, method: step.method, status: 'skipped', httpStatus: null,
        elapsedMs: 0, errorCode: 'TIMEOUT', assertions: [], extractedNames: [] })
      continue
    }
    try {
      const placeholders = Object.fromEntries(allExtractNames.map(name => [name, '']))
      const parseValues = { ...values, ...placeholders }
      const parsed = await parseBrunoManifest({ collectionId: suite.collectionId, mode: 'create',
        files: [{ path: step.path, content: step.source }] }, parseValues, secretNames)
      if (parsed.issues.length || parsed.requests.length !== 1) throw new HttpCheckError('CONFIG_ERROR')
      const runtimeValues = { ...values, ...(Object.fromEntries(Object.entries(runtime).filter(([, value]) => value !== null)) as Record<string, string>) }
      const config: any = resolveStepConfig(parsed.requests[0]!.config, runtimeValues)
      const remaining = Math.max(1, Math.min(STEP_LIMIT_MS, budget - (Date.now() - started)))
      const response = await executeHttpRequest({ ...config, url: config.url, timeout: remaining / 1000,
        maxRedirects: config.maxRedirects, ignoreTls: config.ignoreTls, cacheBust: config.cacheBust }, Date.now(), AbortSignal.timeout(remaining))
      const evaluation = evaluateAssertions(config.assertions ?? empty,
        { status: response.status, elapsed: response.elapsed, headers: response.headers, body: response.body }, true)
      let passed = !evaluation.error && evaluation.passed
      if (!evaluation.error && !config.assertions?.rules?.some((rule: any) => rule.source === 'status')
        && !acceptedStatus(response.status, config.acceptedStatuscodes)) passed = false
      const extracted = extractTestVariables(step.extract || [], response)
      for (const [name, value] of Object.entries(extracted)) runtime[name] = value
      results.push({ stepIndex: index, path: step.path, name: step.name, method: step.method,
        status: passed ? 'pass' : 'fail', httpStatus: response.status, elapsedMs: Math.round(response.elapsed),
        errorCode: evaluation.error || (!passed ? 'ASSERTIONS_FAILED' : null),
        assertions: { passed: !!evaluation.passed, rules: sanitizeRules(evaluation.rules) }, extractedNames: Object.keys(extracted) })
      if (!passed && definition.failFast !== false) {
        overall = 'fail'
        for (let rest = index + 1; rest < steps.length; rest++) {
          const skipped = steps[rest]!
          results.push({ stepIndex: rest, path: skipped.path, name: skipped.name, method: skipped.method,
            status: 'skipped', httpStatus: null, elapsedMs: 0, errorCode: 'SKIPPED', assertions: [], extractedNames: [] })
        }
        break
      }
    } catch (error: any) {
      const code = error instanceof HttpCheckError ? error.code : error?.name === 'TimeoutError' ? 'TIMEOUT' : 'CONFIG_ERROR'
      results.push({ stepIndex: index, path: step.path, name: step.name, method: step.method, status: 'fail',
        httpStatus: null, elapsedMs: Date.now() - started, errorCode: code, assertions: [], extractedNames: [] })
      overall = 'fail'
      if (definition.failFast !== false) break
    }
  }

  const durationMs = Date.now() - started
  const summary = { total: results.length, passed: results.filter(row => row.status === 'pass').length,
    failed: results.filter(row => row.status === 'fail').length, skipped: results.filter(row => row.status === 'skipped').length,
    durationMs, extractedNames: [...new Set(results.flatMap(row => row.extractedNames || []))] }
  await prisma.$transaction(async tx => {
    await tx.brunoTestStep.createMany({ data: results.map(row => ({ ...row, runId: run.id,
      status: row.status, httpStatus: row.httpStatus, elapsedMs: Math.max(0, Number(row.elapsedMs) || 0),
      assertions: row.assertions, extractedNames: row.extractedNames })) })
    await tx.brunoTestRun.update({ where: { id: run.id }, data: { status: overall, finishedAt: new Date(), summary } })
  })
  return { ok: true, data: { runId: String(run.id), status: overall, summary } }
}
