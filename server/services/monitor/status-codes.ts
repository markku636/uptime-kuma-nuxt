// Accepted HTTP status codes, uptime-kuma style: ["200-299", "301", "404"].
// Pure helpers (no Nitro imports) so they can be unit tested.

/** Accepts an array, a JSON array string or a comma separated string */
export function normalizeStatusCodes(value: unknown): string[] {
  let list: unknown = value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      list = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split(',')
    } catch {
      list = trimmed.split(',')
    }
  }
  if (!Array.isArray(list)) return []
  return list
    .map(v => String(v).trim())
    .filter(v => /^\d{3}(-\d{3})?$/.test(v))
}

/**
 * True when `status` matches one of the accepted entries. With no entries the
 * historical default applies (2xx and 3xx are up).
 */
export function isStatusAccepted(status: number, accepted: unknown): boolean {
  const list = normalizeStatusCodes(accepted)
  if (list.length === 0) return status >= 200 && status < 400
  return list.some((entry) => {
    const [lo, hi] = entry.split('-').map(Number)
    return hi === undefined ? status === lo : status >= lo && status <= hi
  })
}

/**
 * Normalise a monitor create/update payload coming from either monitor form:
 *  - headers may be an object or a JSON string
 *  - basic auth may use basic_auth_user / basic_auth_pass
 *  - acceptedStatuscodes may be an array or "200-299, 404"
 */
export function normalizeMonitorPayload<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== 'object') return body
  const out: Record<string, any> = { ...body }

  if (typeof out.headers === 'string') {
    const text = out.headers.trim()
    if (!text) {
      out.headers = null
    } else {
      try {
        out.headers = JSON.parse(text)
      } catch {
        // leave as-is; validation reports it
      }
    }
  }
  if (out.headers && typeof out.headers === 'object' && !Array.isArray(out.headers)) {
    out.headers = Object.fromEntries(Object.entries(out.headers).map(([k, v]) => [k, String(v ?? '')]))
  }

  if (out.basicAuthUser === undefined && out.basic_auth_user !== undefined) out.basicAuthUser = out.basic_auth_user
  if (out.basicAuthPass === undefined && out.basic_auth_pass !== undefined) out.basicAuthPass = out.basic_auth_pass
  delete out.basic_auth_user
  delete out.basic_auth_pass

  if (out.acceptedStatuscodes !== undefined && out.acceptedStatuscodes !== null) {
    out.acceptedStatuscodes = normalizeStatusCodes(out.acceptedStatuscodes)
  }
  return out as T
}
