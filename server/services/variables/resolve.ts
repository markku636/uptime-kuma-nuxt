// server/services/variables/resolve.ts
// {{name}} placeholders in monitor fields, filled at check time from the
// user's variables (workspace variables override global ones).
// Pure functions, covered by tests/server/variables-resolve.test.ts.

export const VARIABLE_NAME = /^[A-Za-z_][\w.-]{0,99}$/

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

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

export interface ScopedVariable {
  name: string
  value: string
  workspaceId: number | null
}

/** Effective variables for a monitor in `workspaceId`: its workspace wins over global */
export function variablesForWorkspace(all: ScopedVariable[], workspaceId: number | null): Record<string, string> {
  const vars: Record<string, string> = {}
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
    out = out.replace(PLACEHOLDER, (match, name) => {
      if (name in vars) return vars[name]
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
 * A copy of the monitor with placeholders filled. `missing` lists names that
 * had no value; the caller reports them instead of checking a broken URL.
 */
export function applyVariables<T extends Record<string, any>>(monitor: T, vars: Record<string, string>): { monitor: T; missing: string[] } {
  const missing = new Set<string>()
  const out: Record<string, any> = { ...monitor }
  for (const field of VARIABLE_FIELDS) {
    if (typeof out[field] === 'string' && out[field].includes('{{')) out[field] = fill(out[field], vars, missing)
  }
  const headers = headersOf(monitor.headers)
  if (headers) {
    const filled: Record<string, string> = {}
    for (const [k, v] of Object.entries(headers)) filled[fill(k, vars, missing)] = fill(String(v ?? ''), vars, missing)
    out.headers = typeof monitor.headers === 'string' ? JSON.stringify(filled) : filled
  }
  return { monitor: out as T, missing: [...missing] }
}
