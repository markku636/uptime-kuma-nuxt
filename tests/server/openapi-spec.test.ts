import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { API_TAGS, DEFAULT_VARS, ENDPOINTS, acceptsApiKey, buildOpenApiSpec, operationId } from '../../server/openapi/spec'
import { isApiKeyPath, isForbiddenForApiKey } from '../../server/services/auth/api-key'

const apiDir = join(__dirname, '../../server/api')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** server/api/v1/monitors/[id].get.ts -> { method: 'get', path: '/api/v1/monitors/{id}' } */
function routeOf(file: string) {
  const rel = relative(apiDir, file).split(sep).join('/').replace(/\.ts$/, '')
  const match = rel.match(/^(.*?)(?:\.(get|post|put|delete|patch))?$/)!
  const path = `/api/${match[1]}`
    .replace(/\[(\w+)\]/g, '{$1}')
    .replace(/\/index$/, '')
  return { method: match[2] as string | undefined, path }
}

describe('API catalogue', () => {
  const routes = walk(apiDir).map(routeOf)
  const key = (method: string, path: string) => `${method} ${path}`
  const documented = new Set(ENDPOINTS.map(e => key(e.method, e.path)))

  it('documents every route file under server/api', () => {
    const missing = routes
      .filter(r => r.method
        ? !documented.has(key(r.method, r.path))
        : !ENDPOINTS.some(e => e.path === r.path))
      .map(r => key(r.method ?? 'any', r.path))
    expect(missing).toEqual([])
  })

  it('documents no route that does not exist', () => {
    const existing = new Set(routes.flatMap(r => r.method
      ? [key(r.method, r.path)]
      : ['get', 'post', 'put', 'delete'].map(m => key(m, r.path))))
    expect(ENDPOINTS.map(e => key(e.method, e.path)).filter(k => !existing.has(k))).toEqual([])
  })

  it('has no duplicate operations and unique operationIds', () => {
    expect(documented.size).toBe(ENDPOINTS.length)
    expect(new Set(ENDPOINTS.map(operationId)).size).toBe(ENDPOINTS.length)
  })

  it('uses known tags and variables', () => {
    const tags = new Set(API_TAGS.map(t => t.name))
    for (const e of ENDPOINTS) {
      expect(tags.has(e.tag), `${e.path}: tag ${e.tag}`).toBe(true)
      for (const [, name] of e.path.matchAll(/\{(\w+)\}/g)) {
        const variable = e.params?.[name]
        expect(variable && variable in DEFAULT_VARS, `${e.path}: param ${name}`).toBe(true)
      }
    }
  })
})

describe('buildOpenApiSpec', () => {
  const spec = buildOpenApiSpec('http://example.test:1234/')

  it('uses an absolute server URL so API clients can run requests', () => {
    expect(spec.servers).toEqual([{ url: 'http://example.test:1234', description: 'This server' }])
  })

  it('marks public endpoints as needing no auth', () => {
    const login = spec.paths['/api/auth/login'].post as any
    const monitors = spec.paths['/api/v1/monitors'].get as any
    expect(login.security).toEqual([])
    expect(monitors.responses[401]).toBeDefined()
  })

  it('offers API key auth exactly where the middleware accepts it', () => {
    const monitors = spec.paths['/api/v1/monitors'].get as any
    const apiKeys = spec.paths['/api/v1/api-keys'].get as any
    const profile = spec.paths['/api/auth/profile'].get as any
    expect(monitors.security).toEqual([{ cookieAuth: [] }, { apiKeyHeader: [] }, { bearerAuth: [] }])
    expect(apiKeys.security).toBeUndefined()
    expect(profile.security).toBeUndefined()
    expect(Object.keys(spec.components.securitySchemes)).toEqual(['cookieAuth', 'apiKeyHeader', 'bearerAuth'])

    for (const e of ENDPOINTS) {
      expect(acceptsApiKey(e.path), e.path).toBe(isApiKeyPath(e.path) && !isForbiddenForApiKey(e.path))
    }
  })

  it('gives every JSON body an example without unresolved placeholders', () => {
    for (const e of ENDPOINTS.filter(x => x.body !== undefined)) {
      const media = (spec.paths[e.path][e.method] as any).requestBody.content['application/json']
      expect(media.example ?? media.examples?.default?.value, e.path).toBeDefined()
    }
    expect(JSON.stringify(spec)).not.toContain('{{')
  })

  it('only references schemas that exist', () => {
    const refs = [...JSON.stringify(spec).matchAll(/#\/components\/schemas\/(\w+)/g)].map(m => m[1])
    for (const ref of refs) expect(spec.components.schemas[ref], ref).toBeDefined()
  })
})
