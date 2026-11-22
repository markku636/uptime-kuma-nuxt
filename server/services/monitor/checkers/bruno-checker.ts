import type { CheckResult } from '../checker'
import type { BrunoManifest } from '../../../../shared/types/bruno'
import { parseBrunoManifest } from '../../bruno/parser'
import { executeHttpRequest, HttpCheckError } from './http-request'
import { assertionsSchema, evaluateAssertions } from '../../../utils/assertions'

const messages: Record<string, string> = {
  CONFIG_ERROR: 'Invalid Bruno request',
  DESTINATION_DENIED: 'Destination is not permitted',
  TIMEOUT: 'Request deadline exceeded',
  RESPONSE_TOO_LARGE: 'Response exceeds the byte limit',
  REQUEST_TOO_LARGE: 'Request exceeds the byte limit',
  INVALID_RESPONSE: 'Invalid HTTP response',
  NETWORK_ERROR: 'Network request failed',
  AUTH_ERROR: 'Authentication request failed',
  REDIRECT_LIMIT: 'Redirect limit exceeded',
  HTTP_STATUS: 'HTTP status was not accepted',
  ASSERTIONS_FAILED: 'Response assertions failed',
}
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

/**
 * Runs a single declarative Bruno request stored on the monitor (in `body`).
 * No scripts/tests are executed — the shared parser strips them before use.
 */
export async function checkBruno(monitor: any, start: number, externalSignal?: AbortSignal): Promise<CheckResult> {
  const source = typeof monitor.body === 'string' ? monitor.body : ''
  if (!source || Buffer.byteLength(source) > 131072) {
    return { status: 0, ping: 0, msg: messages.CONFIG_ERROR!, code: 'CONFIG_ERROR' }
  }
  const timeout = Number(monitor.timeout || 48)
  const deadline = AbortSignal.timeout(Math.max(1, Math.ceil(start + (Number.isFinite(timeout) ? timeout : 48) * 1000 - Date.now())))
  const signal = externalSignal ? AbortSignal.any([deadline, externalSignal]) : deadline

  try {
    const manifest: BrunoManifest = {
      collectionId: `monitor-${monitor.id || 'preview'}`,
      files: [{ path: 'request.bru', content: source }],
      mode: 'create',
    }
    const parsed = await parseBrunoManifest(manifest)
    if (parsed.issues.length || parsed.requests.length !== 1) {
      return { status: 0, ping: Date.now() - start, msg: messages.CONFIG_ERROR!, code: 'CONFIG_ERROR' }
    }
    const config = { ...parsed.requests[0]!.config }
    const response = await executeHttpRequest({
      ...config,
      url: config.url,
      timeout: monitor.timeout,
      maxRedirects: monitor.maxRedirects,
      ignoreTls: monitor.ignoreTls,
      cacheBust: monitor.cacheBust,
    }, start, signal)

    const parsedAssertions = assertionsSchema.safeParse(config.assertions ?? empty)
    if (!parsedAssertions.success) {
      return { status: 0, ping: Date.now() - start, msg: messages.CONFIG_ERROR!, code: 'CONFIG_ERROR' }
    }
    let evaluation = evaluateAssertions(parsedAssertions.data, response)
    if (evaluation.error) {
      return { status: 0, ping: Date.now() - start, msg: messages[evaluation.error] || messages.CONFIG_ERROR!, code: evaluation.error, assertionResults: evaluation }
    }
    let passed = evaluation.passed
    let code = passed ? 'CHECK_OK' : 'ASSERTIONS_FAILED'
    if (!parsedAssertions.data.rules.some(rule => rule.source === 'status') && !acceptedStatus(response.status, config.acceptedStatuscodes)) {
      passed = false
      code = 'HTTP_STATUS'
    }
    const up = monitor.upsideDown ? !passed : passed
    return {
      status: up ? 1 : 0,
      ping: Date.now() - start,
      msg: up ? (monitor.upsideDown ? 'Check passed (inverted)' : `Bruno check passed (${parsed.requests[0]!.name || 'request'})`) : (messages[code] || 'Check failed'),
      code: up ? 'CHECK_OK' : code,
      assertionResults: evaluation,
    }
  } catch (error: any) {
    const code = signal.aborted ? 'TIMEOUT' : error instanceof HttpCheckError ? error.code : 'CONFIG_ERROR'
    return { status: 0, ping: Date.now() - start, msg: messages[code] || messages.CONFIG_ERROR!, code }
  }
}
