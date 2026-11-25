import brunoLang from '@usebruno/lang'

/**
 * Replaces every literal request value in a declarative .bru request with a secret reference.
 * `{{variable}}` references are kept as-is; structural metadata (method, names, enabled flags)
 * is preserved. The caller supplies the placeholder naming strategy so both export paths can
 * share exactly the same redaction contract. Returns null when the source cannot be rewritten.
 */
export function redactBrunoSource(source: string, protect: (value: string, field: string) => string): string | null {
  let ast: any
  try { ast = brunoLang.bruToJsonV2(source) } catch { return null }
  const value = (input: unknown, field: string): string => {
    if (typeof input !== 'string') return ''
    if (!input.trim()) return input
    return /\{\{\s*[^{}]+\s*\}\}/.test(input) ? input : protect(input, field)
  }
  if (ast.http?.url !== undefined) ast.http.url = value(ast.http.url, 'url')
  if (Array.isArray(ast.params)) ast.params = ast.params.map((pair: any, index: number) => pair && {...pair, value: value(pair.value, `query_${index}`)})
  if (Array.isArray(ast.headers)) ast.headers = ast.headers.map((header: any, index: number) => header && {...header, value: value(header.value, `header_${index}`)})
  if (ast.body) {
    for (const mode of ['json', 'text']) if (ast.body[mode] !== undefined) ast.body[mode] = value(ast.body[mode], 'body')
    if (Array.isArray(ast.body.formUrlEncoded)) ast.body.formUrlEncoded = ast.body.formUrlEncoded.map((pair: any, index: number) => pair && {...pair, value: value(pair.value, `form_${index}`)})
  }
  if (ast.vars) {
    for (const kind of ['req', 'res']) if (Array.isArray(ast.vars[kind])) ast.vars[kind] = ast.vars[kind].map((pair: any, index: number) => pair && {...pair, value: value(pair.value, `var_${kind}_${index}`)})
  }
  // Any auth provider (basic/bearer/apikey/awsv4/oauth2/...) gets all of its string fields redacted;
  // only structural mode/placement values stay as they are.
  if (ast.auth && typeof ast.auth === 'object') {
    for (const [provider, fields] of Object.entries(ast.auth)) {
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) continue
      const rewritten: Record<string, unknown> = {}
      for (const [key, fieldValue] of Object.entries(fields as Record<string, unknown>)) {
        rewritten[key] = key === 'mode' || key === 'placement' ? fieldValue : value(fieldValue, `auth_${provider}_${key}`)
      }
      ast.auth[provider] = rewritten
    }
  }
  if (Array.isArray(ast.assertions)) {
    ast.assertions = ast.assertions.map((assertion: any, index: number) => {
      if (!assertion) return assertion
      const raw = String(assertion.value ?? '').trim()
      const match = /^(\S+)(?:\s+([\s\S]+))?$/.exec(raw)
      const rewritten = {...assertion, value: match?.[2] ? `${match[1]} ${value(match[2], `assert_${index}`)}` : assertion.value}
      if (typeof assertion.description === 'string') rewritten.description = value(assertion.description, `description_${index}`)
      if (Array.isArray(assertion.annotations)) rewritten.annotations = assertion.annotations.map((annotation: any, position: number) =>
        annotation && {...annotation, value: value(annotation.value, `annotation_${index}_${position}`)})
      return rewritten
    })
  }
  if (typeof ast.docs === 'string') ast.docs = value(ast.docs, 'docs')
  if (ast.script?.req !== undefined) ast.script.req = value(ast.script.req, 'script_req')
  if (ast.script?.res !== undefined) ast.script.res = value(ast.script.res, 'script_res')
  if (ast.tests !== undefined) ast.tests = value(ast.tests, 'tests')
  try { return brunoLang.jsonToBruV2(ast) } catch { return null }
}
