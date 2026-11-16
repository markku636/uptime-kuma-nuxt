// server/services/variables/resolve.ts
// {{name}} placeholders in monitor fields, filled at check time from the
// user's variables (workspace variables override global ones).
// Pure functions, covered by tests/server/variables-resolve.test.ts.

/** Names: letters, digits, _ . - ; not starting with a digit; never an Object built-in */
export const VARIABLE_NAME = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z_][\w.-]{0,99}$/

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

/** A filled field may not grow beyond this (protects against nested expansion blowing up) */
export const MAX_FILLED_LENGTH = 64 * 1024

/** Text fields of a monitor that may contain {{name}} */
export const VARIABLE_FIELDS = [
  'url',
  'hostname',
  'body',
  'keyword',
  'basicAuthUser',
  'basicAuthPass',
  'jsonPath',
  'expectedValue',
  'grpcUrl',
  'grpcBody',
  'grpcMetadata',
  'databaseConnectionString',
  'databaseQuery',
  'dnsResolver',
  'mqttTopic',
  'mqttUsername',
  'mqttPassword',
  'redisConnectionString',
] as const

/**
 * Fields that cannot work with a placeholder left in them. An unknown name
 * there fails the check; elsewhere (body, keyword, headers…) `{{…}}` may be
 * literal text, e.g. a templated page, and is left as it is.
 */
const STRICT_FIELDS = new Set<string>(['url', 'hostname', 'grpcUrl', 'databaseConnectionString', 'redisConnectionString', 'dnsResolver'])

export class VariableExpansionError extends Error {}

export interface ScopedVariable {
  name: string
  value: string
  workspaceId: number | null
}

/** Effective variables for a monitor in `workspaceId`: its workspace wins over global */
export function variablesForWorkspace(all: ScopedVariable[], workspaceId: number | null): Record<string, string> {
  // No prototype: a name like "constructor" must not resolve to a built-in
  const vars: Record<string, string> = Object.create(null)
  for (const v of all) if (v.workspaceId == null) vars[v.name] = v.value
  if (workspaceId != null) for (const v of all) if (v.workspaceId === workspaceId) vars[v.name] = v.value
  return vars
}

export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map(m => m[1]))]
}

/** Fill placeholders; a value may itself use other variables (one level) */
export function fill(text: string, vars: Record<string, string>, missing: Set<string>): string {
  let out = text
  for (let pass = 0; pass < 2; pass++) {
    // Track the projected length while replacing, so a value used many
    // times fails before a huge string is ever built
    let length = out.length
    out = out.replace(PLACEHOLDER, (match, name) => {
      if (Object.prototype.hasOwnProperty.call(vars, name)) {
        const value = vars[name]
        length += value.length - match.length
        if (length > MAX_FILLED_LENGTH) throw new VariableExpansionError('Variable values make a field too long')
        return value
      }
      if (pass === 1) missing.add(name)
      return match
    })
  }
  return out
}

function headersOf(value: unknown): Record<string, string> | null {
  if (!value) return null
  if (typeof value === 'string') {
    try { return headersOf(JSON.parse(value)) } catch { return null }
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, string>
  return null
}

/** True when any variable-capable field of the monitor contains a placeholder */
export function usesVariables(monitor: Record<string, any>): boolean {
  const check = (v: unknown) => typeof v === 'string' && v.includes('{{')
  if (VARIABLE_FIELDS.some(f => check(monitor[f]))) return true
  const headers = headersOf(monitor.headers)
  return !!headers && Object.entries(headers).some(([k, v]) => check(k) || check(v))
}

/**
 * A copy of the monitor with placeholders filled. `missing` lists unknown
 * names in fields that cannot work without them (URL, host, connection
 * strings); unknown names elsewhere stay as literal text.
 */
export function applyVariables<T extends Record<string, any>>(monitor: T, vars: Record<string, string>): { monitor: T; missing: string[] } {
  const missing = new Set<string>()
  const ignored = new Set<string>()
  const out: Record<string, any> = { ...monitor }
  for (const field of VARIABLE_FIELDS) {
    if (typeof out[field] === 'string' && out[field].includes('{{')) {
      out[field] = fill(out[field], vars, STRICT_FIELDS.has(field) ? missing : ignored)
    }
  }
  const headers = headersOf(monitor.headers)
  if (headers) {
    const filled: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) filled[fill(k, vars, ignored)] = fill(String(v ?? ''), vars, ignored)
    out.headers = typeof monitor.headers === 'string' ? JSON.stringify(filled) : filled
  }
  return { monitor: out as T, missing: [...missing] }
}

/** Replace secret values in a message (e.g. an error that echoes a URL) */
export function maskSecrets(text: string, secrets: string[]): string {
  // Also the URL-encoded form (a secret in a query string is echoed encoded);
  // longest first, so a secret containing another one is masked whole
  const forms = new Set<string>()
  for (const secret of secrets) {
    if (secret.length < 4) continue
    forms.add(secret)
    try { forms.add(encodeURIComponent(secret)) } catch { /* lone surrogate */ }
  }
  let out = text
  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    out = out.split(form).join('••••••')
  }
  return out
}
