import { describe, expect, it } from 'vitest'
import {
  interpolate,
  isDraftReady,
  parseAssertions,
  parseBruBlocks,
  parseBrunoCollectionJson,
  parseBrunoInput,
  parseBruRequest,
  resolveRequest,
  toMonitorDraft,
} from '../../utils/bruno'

const GET_USERS = `meta {
  name: List users
  type: http
  seq: 2
}

get {
  url: {{baseUrl}}/api/users?page=1
  body: none
  auth: bearer
}

headers {
  Accept: application/json
  ~X-Disabled: nope
}

auth:bearer {
  token: {{token}}
}

assert {
  res.status: eq 200
  res.body: contains "users"
}

tests {
  test("ok", function() {
    expect(res.status).to.equal(200);
  });
}
`

const CREATE_ORDER = `meta {
  name: Create order
  type: http
  seq: 1
}

post {
  url: https://shop.example.com/orders
  body: json
  auth: basic
}

auth:basic {
  username: admin
  password: s3cret
}

body:json {
  {
    "sku": "A-1",
    "qty": 2
  }
}

assert {
  res.status: gte 200
  res.status: lt 300
}
`

describe('parseBruBlocks', () => {
  it('splits dictionary, text and list blocks', () => {
    const blocks = parseBruBlocks(`vars {\n  a: 1\n}\nvars:secret [\n  token,\n  apiKey\n]\nbody:json {\n  {\n    "x": 1\n  }\n}\n`)
    expect(blocks.map(b => b.name)).toEqual(['vars', 'vars:secret', 'body:json'])
    expect(blocks[0].dict).toEqual([{ key: 'a', value: '1' }])
    expect(blocks[1].list).toEqual(['token', 'apiKey'])
    expect(blocks[2].text).toBe('{\n  "x": 1\n}')
  })

  it('handles CRLF line endings', () => {
    expect(parseBruRequest(GET_USERS.replace(/\n/g, '\r\n'))?.url).toBe('{{baseUrl}}/api/users?page=1')
  })
})

describe('parseBruRequest', () => {
  it('reads method, url, headers, bearer auth and assertions', () => {
    const req = parseBruRequest(GET_USERS, 'users/list.bru')!
    expect(req).toMatchObject({
      name: 'List users',
      folder: 'users',
      method: 'GET',
      url: '{{baseUrl}}/api/users?page=1',
      headers: [{ key: 'Accept', value: 'application/json' }],
      auth: { mode: 'bearer', token: '{{token}}' },
      expectedStatus: ['200'],
      keyword: 'users',
      seq: 2,
    })
  })

  it('reads json body, basic auth and status ranges', () => {
    const req = parseBruRequest(CREATE_ORDER, 'orders.bru')!
    expect(req.method).toBe('POST')
    expect(req.bodyMode).toBe('json')
    expect(JSON.parse(req.body)).toEqual({ sku: 'A-1', qty: 2 })
    expect(req.auth).toEqual({ mode: 'basic', username: 'admin', password: 's3cret' })
    expect(req.expectedStatus).toEqual(['200-299'])
  })

  it('ignores non-request files', () => {
    expect(parseBruRequest('meta {\n  name: Folder\n}\n')).toBeNull()
    expect(parseBruRequest('meta {\n  type: graphql\n}\npost {\n  url: x\n}\n')).toBeNull()
  })
})

describe('parseAssertions', () => {
  it('supports eq, in and comparison pairs', () => {
    expect(parseAssertions([{ key: 'res.status', value: 'in [200, 204]' }]).expectedStatus).toEqual(['200', '204'])
    expect(parseAssertions([{ key: 'res.status', value: 'lte 399' }]).expectedStatus).toEqual(['100-399'])
    expect(parseAssertions([{ key: 'res.status', value: 'isDefined' }]).expectedStatus).toEqual([])
  })
})

describe('collection folder', () => {
  it('applies collection headers/auth, environments and sorting', () => {
    const result = parseBrunoInput([
      { path: 'shop/bruno.json', text: '{"version":"1","name":"Shop API","type":"collection"}' },
      { path: 'shop/collection.bru', text: 'headers {\n  X-Client: kuma\n}\n\nauth {\n  mode: bearer\n}\n\nauth:bearer {\n  token: {{token}}\n}\n' },
      { path: 'shop/environments/Prod.bru', text: 'vars {\n  baseUrl: https://api.example.com\n}\nvars:secret [\n  token\n]\n' },
      { path: 'shop/users/folder.bru', text: 'meta {\n  name: users\n}\n' },
      { path: 'shop/users/list.bru', text: GET_USERS.replace('auth: bearer', 'auth: inherit') },
      { path: 'shop/orders.bru', text: CREATE_ORDER },
    ])
    expect(result.collectionName).toBe('Shop API')
    expect(result.environments).toEqual([{ name: 'Prod', variables: { baseUrl: 'https://api.example.com', token: '' } }])
    expect(result.requests.map(r => r.name)).toEqual(['Create order', 'List users'])
    const list = result.requests[1]
    expect(list.auth).toEqual({ mode: 'bearer', token: '{{token}}' })
    expect(list.headers.map(h => h.key)).toEqual(['X-Client', 'Accept'])
    // collection root folder ("shop/") is stripped
    expect(result.requests.map(r => r.folder)).toEqual(['', 'users'])
  })
})

describe('parseBrunoCollectionJson', () => {
  const json = {
    name: 'Exported',
    version: '1',
    items: [
      {
        type: 'folder',
        name: 'Health',
        items: [
          {
            type: 'http-request',
            name: 'Ping',
            seq: 1,
            request: {
              method: 'get',
              url: '{{host}}/health',
              headers: [{ name: 'Accept', value: 'text/plain', enabled: true }, { name: 'X-Off', value: '1', enabled: false }],
              body: { mode: 'none' },
              auth: { mode: 'none' },
              assertions: [{ name: 'res.status', value: 'eq 204', enabled: true }],
            },
          },
        ],
      },
      {
        type: 'http-request',
        name: 'Login',
        request: {
          method: 'POST',
          url: 'https://example.com/login',
          body: { mode: 'formUrlEncoded', formUrlEncoded: [{ name: 'user', value: 'a b', enabled: true }] },
          auth: { mode: 'awsv4' },
        },
      },
      { type: 'graphql-request', name: 'GQL', request: { url: 'x' } },
    ],
    environments: [{ name: 'Local', variables: [{ name: 'host', value: 'http://localhost:3000', enabled: true }] }],
  }

  it('flattens folders and keeps only http requests', () => {
    const result = parseBrunoCollectionJson(json)
    expect(result.requests.map(r => [r.folder, r.name, r.method])).toEqual([
      ['Health', 'Ping', 'GET'],
      ['', 'Login', 'POST'],
    ])
    expect(result.requests[0].headers).toEqual([{ key: 'Accept', value: 'text/plain' }])
    expect(result.requests[0].expectedStatus).toEqual(['204'])
    expect(result.requests[1].body).toBe('user=a%20b')
    expect(result.requests[1].auth).toEqual({ mode: 'unsupported', type: 'awsv4' })
    expect(result.environments[0].variables.host).toBe('http://localhost:3000')
  })

  it('reports non-collection JSON', () => {
    expect(parseBrunoCollectionJson({ foo: 1 }).errors).toHaveLength(1)
  })
})

describe('conversion to monitor drafts', () => {
  it('resolves variables and maps auth, keyword and content type', () => {
    const req = parseBruRequest(GET_USERS, 'users/list.bru')!
    const draft = toMonitorDraft(resolveRequest(req, { baseUrl: 'https://api.example.com', token: 'abc' }))
    expect(draft).toMatchObject({
      type: 'keyword',
      name: 'users / List users',
      url: 'https://api.example.com/api/users?page=1',
      keyword: 'users',
      acceptedStatuscodes: ['200'],
      warnings: [],
    })
    expect(draft.headers).toContainEqual({ key: 'Authorization', value: 'Bearer abc' })
    expect(isDraftReady(draft)).toBe(true)

    const order = toMonitorDraft(parseBruRequest(CREATE_ORDER, 'orders.bru')!)
    expect(order).toMatchObject({ type: 'http', authMethod: 'basic', basicAuthUser: 'admin', basicAuthPass: 's3cret' })
    expect(order.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' })
  })

  it('flags unresolved variables', () => {
    const draft = toMonitorDraft(parseBruRequest(GET_USERS)!)
    expect(draft.warnings[0]).toMatch(/Unresolved variables: baseUrl, token/)
    expect(isDraftReady(draft)).toBe(false)
  })

  it('interpolates nested variables', () => {
    expect(interpolate('{{url}}/x', { url: '{{host}}:8080', host: 'http://h' })).toBe('http://h:8080/x')
  })
})
