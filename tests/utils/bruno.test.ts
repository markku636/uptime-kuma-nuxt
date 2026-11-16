import { describe, expect, it } from 'vitest'
import {
  applyPathParams,
  interpolate,
  isDraftReady,
  parseAssertions,
  parseBruBlocks,
  parseBrunoCollectionJson,
  parseBrunoInput,
  parseBruRequest,
  requestVariables,
  resolveRequest,
  toBrunoCollection,
  toMonitorDraft,
  variablesFor,
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
    expect(parseBruRequest('meta {\n  type: grpc\n}\npost {\n  url: x\n}\n')).toBeNull()
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
    expect(result.environments).toEqual([{ name: 'Prod', variables: { baseUrl: 'https://api.example.com', token: '' }, secrets: ['token'] }])
    expect(result.secretVars).toEqual(['token'])
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
      { type: 'grpc-request', name: 'Grpc', request: { url: 'y' } },
    ],
    environments: [{ name: 'Local', variables: [{ name: 'host', value: 'http://localhost:3000', enabled: true }] }],
  }

  it('flattens folders and keeps http and graphql requests', () => {
    const result = parseBrunoCollectionJson(json)
    expect(result.requests.map(r => [r.folder, r.name, r.method])).toEqual([
      ['Health', 'Ping', 'GET'],
      ['', 'Login', 'POST'],
      ['', 'GQL', 'GET'],
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

describe('Bruno compatibility', () => {
  it('reads multi-line values', () => {
    const blocks = parseBruBlocks("headers {\n  x-json: '''\n    {\n      \"a\": 1\n    }\n  '''\n  x-next: 2\n}\n")
    expect(blocks[0].dict).toEqual([{ key: 'x-json', value: '{\n  "a": 1\n}' }, { key: 'x-next', value: '2' }])
  })

  it('applies path params and keeps ports intact', () => {
    expect(applyPathParams('http://host:8080/users/:id/posts/:postId', [{ key: 'id', value: '7' }, { key: 'postId', value: '{{pid}}' }]))
      .toBe('http://host:8080/users/7/posts/{{pid}}')
  })

  it('turns a GraphQL request into a JSON POST body', () => {
    const req = parseBruRequest('meta {\n  type: graphql\n}\npost {\n  url: https://x/graphql\n  body: graphql\n}\nbody:graphql {\n  { me { id } }\n}\nbody:graphql:vars {\n  { "a": 1 }\n}\n')!
    expect(req.bodyMode).toBe('json')
    expect(JSON.parse(req.body)).toEqual({ query: '{ me { id } }', variables: { a: 1 } })
  })

  it('supports API key auth in a header or the query string', () => {
    const header = parseBruRequest('get {\n  url: https://x/a\n  auth: apikey\n}\nauth:apikey {\n  key: X-Api-Key\n  value: {{k}}\n  placement: header\n}\n')!
    expect(toMonitorDraft(resolveRequest(header, { k: 's3cr3t' })).headers).toContainEqual({ key: 'X-Api-Key', value: 's3cr3t' })
    const query = parseBruRequest('get {\n  url: https://x/a?b=1\n  auth: apikey\n}\nauth:apikey {\n  key: api_key\n  value: v 1\n  placement: queryparams\n}\n')!
    expect(toMonitorDraft(query).url).toBe('https://x/a?b=1&api_key=v%201')
  })

  it('inherits headers, auth and vars from folder.bru, inner folders winning', () => {
    const result = parseBrunoInput([
      { path: 'shop/bruno.json', text: '{"name":"Shop"}' },
      { path: 'shop/collection.bru', text: 'headers {\n  X-App: shop\n  X-Level: collection\n}\nauth {\n  mode: bearer\n}\nauth:bearer {\n  token: root\n}\nvars:pre-request {\n  region: eu\n  base: https://col\n}\n' },
      { path: 'shop/admin/folder.bru', text: 'meta {\n  name: Admin\n}\nheaders {\n  X-Level: admin\n}\nauth {\n  mode: basic\n}\nauth:basic {\n  username: adm\n  password: pw\n}\nvars:pre-request {\n  base: https://admin\n}\n' },
      { path: 'shop/admin/users/folder.bru', text: 'auth {\n  mode: inherit\n}\nvars:pre-request {\n  page: 2\n}\n' },
      { path: 'shop/admin/users/list.bru', text: 'get {\n  url: {{base}}/users?page={{page}}&r={{region}}\n  auth: inherit\n}\nvars:pre-request {\n  page: 3\n}\n' },
      { path: 'shop/public.bru', text: 'get {\n  url: {{base}}/ping\n  auth: inherit\n}\n' },
    ])
    const list = result.requests.find(r => r.name === 'list')!
    expect(list.headers).toEqual([{ key: 'X-App', value: 'shop' }, { key: 'X-Level', value: 'admin' }])
    expect(list.auth).toEqual({ mode: 'basic', username: 'adm', password: 'pw' })
    expect(list.vars).toEqual({ base: 'https://admin', page: '3' })
    // collection < environment < folder/request vars
    const vars = variablesFor(list, result.collectionVars, { region: 'us', base: 'https://env' })
    expect(resolveRequest(list, vars).url).toBe('https://admin/users?page=3&r=us')
    const ping = result.requests.find(r => r.name === 'public')!
    expect(ping.auth).toEqual({ mode: 'bearer', token: 'root' })
    expect(resolveRequest(ping, variablesFor(ping, result.collectionVars, undefined)).url).toBe('https://col/ping')
  })

  it('reads the collection .env as process.env and masks it', () => {
    const result = parseBrunoInput([
      { path: 'c/bruno.json', text: '{"name":"C"}' },
      { path: 'c/.env', text: '# comment\nAPI_TOKEN="abc 123"\nexport HOST=https://h # trailing\n' },
      { path: 'c/r.bru', text: 'get {\n  url: {{process.env.HOST}}/x\n}\nheaders {\n  Authorization: Bearer {{process.env.API_TOKEN}}\n}\n' },
    ])
    expect(result.collectionVars).toEqual({ 'process.env.API_TOKEN': 'abc 123', 'process.env.HOST': 'https://h' })
    expect(result.secretVars).toEqual(['process.env.API_TOKEN', 'process.env.HOST'])
    const r = resolveRequest(result.requests[0], variablesFor(result.requests[0], result.collectionVars, undefined))
    expect(r.url).toBe('https://h/x')
    expect(r.headers[0].value).toBe('Bearer abc 123')
  })

  it('lets user overrides win but ignores empty overrides', () => {
    const req = parseBruRequest('get {\n  url: {{base}}/a\n}\nvars:pre-request {\n  base: https://req\n}\n')!
    expect(variablesFor(req, {}, {}, { base: 'https://mine' }).base).toBe('https://mine')
    expect(variablesFor(req, {}, {}, { base: '' }).base).toBe('https://req')
    expect(requestVariables(req)).toEqual(['base'])
  })

  it('reads folder settings, path params, graphql and secrets from an export', () => {
    const result = parseBrunoCollectionJson({
      name: 'Exp',
      root: { request: { headers: [{ name: 'X-Root', value: '1', enabled: true }], auth: { mode: 'apikey', apikey: { key: 'k', value: '{{key}}', placement: 'header' } } } },
      items: [{
        type: 'folder',
        name: 'Users',
        root: { request: { headers: [{ name: 'X-Folder', value: 'u', enabled: true }], vars: { req: [{ name: 'id', value: '9', enabled: true }] } } },
        items: [
          { type: 'http-request', name: 'Get', request: { method: 'GET', url: '{{host}}/users/:uid', params: [{ name: 'uid', value: '{{id}}', type: 'path', enabled: true }], auth: { mode: 'inherit' } } },
          { type: 'graphql-request', name: 'Q', request: { method: 'POST', url: '{{host}}/gql', body: { mode: 'graphql', graphql: { query: '{ a }', variables: '' } } } },
        ],
      }],
      environments: [{ name: 'Prod', variables: [{ name: 'host', value: 'https://p', enabled: true }, { name: 'key', value: '', enabled: true, secret: true }] }],
    })
    const get = result.requests[0]
    expect(get.url).toBe('{{host}}/users/{{id}}')
    expect(get.headers.map(h => h.key)).toEqual(['X-Root', 'X-Folder'])
    expect(get.auth).toMatchObject({ mode: 'apikey', key: 'k' })
    expect(resolveRequest(get, variablesFor(get, result.collectionVars, result.environments[0].variables)).url).toBe('https://p/users/9')
    expect(JSON.parse(result.requests[1].body)).toEqual({ query: '{ a }', variables: {} })
    expect(result.secretVars).toEqual(['key'])
  })
})

describe('environments picked on their own', () => {
  it('reads a lone environment .bru and an exported environment JSON', () => {
    const result = parseBrunoInput([
      { path: 'Staging.bru', text: 'vars {\n  host: https://staging\n}\nvars:secret [\n  token\n]\n' },
      { path: 'prod-env.json', text: JSON.stringify({ name: 'Prod', variables: [{ name: 'host', value: 'https://prod', enabled: true }, { name: 'token', value: '', enabled: true, secret: true }, { name: 'off', value: 'x', enabled: false }] }) },
      { path: 'ping.bru', text: 'get {\n  url: {{host}}/ping\n}\n' },
    ])
    expect(result.requests.map(r => r.name)).toEqual(['ping'])
    expect(result.environments.map(e => [e.name, e.variables.host])).toEqual([['Staging', 'https://staging'], ['Prod', 'https://prod']])
    expect(result.environments[1].variables).not.toHaveProperty('off')
    expect(result.secretVars).toEqual(['token'])
    expect(result.errors).toEqual([])
  })
})

describe('toBrunoCollection', () => {
  const groups = [{ id: 10, name: 'Web', parent: null }, { id: 11, name: 'Edge', parent: 10 }, { id: 12, name: 'Empty', parent: null }]
  const monitors = [
    { id: 1, name: 'Home', type: 'http', url: '{{host}}/', method: 'GET', acceptedStatuscodes: ['200-299'], parent: 10 },
    { id: 2, name: 'CDN', type: 'keyword', url: 'https://cdn/x', keyword: 'ok', acceptedStatuscodes: ['200'], parent: 11, headers: { 'X-A': '1' } },
    { id: 3, name: 'Login', type: 'http', url: 'https://x/login', method: 'POST', body: '{"u":1}', authMethod: 'basic', basicAuthUser: 'a', basicAuthPass: 'b', acceptedStatuscodes: ['200', '204'], parent: null },
    { id: 4, name: 'DB', type: 'postgres', parent: null },
  ]
  const vars = [{ name: 'host', value: 'https://h', secret: false }, { name: 'token', value: 'hidden', secret: true }]

  it('mirrors groups as folders and skips empty groups and non-HTTP monitors', () => {
    const col = toBrunoCollection('Export', monitors, groups, vars)
    expect(col.items.map((i: any) => [i.type, i.name])).toEqual([['folder', 'Web'], ['http-request', 'Login']])
    expect(col.items[0].items.map((i: any) => i.name)).toEqual(['Edge', 'Home'])
    expect(col.environments[0].variables.find((v: any) => v.name === 'token')).toMatchObject({ value: '', secret: true })
  })

  it('round-trips through the importer', () => {
    const parsed = parseBrunoCollectionJson(toBrunoCollection('Export', monitors, groups, vars))
    const byName = Object.fromEntries(parsed.requests.map(r => [r.name, r]))
    expect(byName.Home.folder).toBe('Web')
    expect(byName.CDN.folder).toBe('Web/Edge')
    expect(byName.Home.expectedStatus).toEqual(['200-299'])
    expect(byName.CDN.keyword).toBe('ok')
    expect(byName.CDN.headers).toEqual([{ key: 'X-A', value: '1' }])
    expect(byName.Login).toMatchObject({ method: 'POST', bodyMode: 'json', body: '{"u":1}', auth: { mode: 'basic', username: 'a', password: 'b' }, expectedStatus: ['200', '204'] })
    const vars2 = variablesFor(byName.Home, parsed.collectionVars, parsed.environments[0].variables)
    expect(resolveRequest(byName.Home, vars2).url).toBe('https://h/')
  })
})
