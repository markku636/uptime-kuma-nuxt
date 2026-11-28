import { parseSelector, parseSafeJson } from '../../utils/assertions'
import type { TestExtraction } from './test-definition'

const MAX_VALUE_BYTES = 4096

function readPath(root: unknown, tokens: ReturnType<typeof parseSelector>) {
  let current: any = root
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined
    if (typeof token === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[token]
    } else {
      if (typeof current !== 'object' || Array.isArray(current) || !Object.hasOwn(current, token)) return undefined
      current = current[token]
    }
  }
  return current
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return null
}

/** Extract declared values from one response; callers must never persist the returned values. */
export function extractTestVariables(
  rules: TestExtraction[],
  response: { status: number; headers: Record<string, string>; body: string; elapsed: number },
): Record<string, string | null> {
  const result: Record<string, string | null> = {}
  if (!rules.length) return result
  let json: unknown
  for (const rule of rules) {
    let value: unknown
    if (rule.source === 'status') value = response.status
    else if (rule.source === 'responseTime') value = response.elapsed
    else if (rule.source === 'header') {
      const headers = Object.fromEntries(Object.entries(response.headers || {}).map(([name, header]) => [name.toLowerCase(), header]))
      value = headers[rule.path!.toLowerCase()]
    } else {
      if (json === undefined) { try { json = parseSafeJson(response.body) } catch { json = null } }
      value = readPath(json, parseSelector(rule.path!))
    }
    const text = stringify(value)
    if (text === null) { result[rule.name] = null; continue }
    result[rule.name] = Buffer.byteLength(text) > MAX_VALUE_BYTES ? text.slice(0, MAX_VALUE_BYTES) : text
  }
  return result
}
