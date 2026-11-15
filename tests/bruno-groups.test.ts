import {test} from 'node:test'
import assert from 'node:assert/strict'
import {inflateRawSync,crc32} from 'node:zlib'
import {randomBytes} from 'node:crypto'
import {parseBrunoManifest} from '../server/services/bruno/parser'
import type {BrunoFile} from '../shared/types/bruno'

process.env.APP_ENCRYPTION_KEY ||= randomBytes(32).toString('hex')

const request = (name: string, extra = '', url = 'http://127.0.0.1/health') =>
  `meta {\n  name: ${name}\n  type: http\n  seq: 1\n}\n\nget {\n  url: ${url}\n  body: none\n  auth: none\n}\n${extra}`

test('scripts, tests, post-response vars and behaviour-changing settings are imported but flagged', async () => {
  const parsed = await parseBrunoManifest({collectionId: 'flags', mode: 'create', files: [
    {path: 'plain.bru', content: request('Plain', '\nsettings {\n  encodeUrl: true\n}\n')},
    {path: 'scripted.bru', content: request('Scripted', '\nscript:pre-request {\n  req.setHeader("x", SECRET_SENTINEL);\n  if (a) { b(); }\n}\n\ntests {\n  test("ok", function() {});\n}\n\nvars:post-response {\n  id: res.body.id\n}\n')},
    {path: 'settings.bru', content: request('Settings', '\nsettings {\n  encodeUrl: false\n}\n')},
  ]})
  assert.deepEqual(parsed.issues, [])
  const flags = Object.fromEntries(parsed.requests.map(row => [row.path, row.skipped]))
  assert.deepEqual(flags['plain.bru'], [])
  assert.deepEqual(flags['scripted.bru'], ['script', 'tests', 'post-response vars'])
  assert.deepEqual(flags['settings.bru'], ['settings'])
  assert.ok(!JSON.stringify(parsed).includes('SECRET_SENTINEL'))
})

test('folders become an ordered folder list named by folder.bru, and folder scripts flag the requests below', async () => {
  const files: BrunoFile[] = [
    {path: 'bruno.json', content: JSON.stringify({version: '1', name: 'Shop API', type: 'collection'})},
    {path: 'root.bru', content: request('Root')},
    {path: 'orders/folder.bru', content: 'meta {\n  name: Orders\n  seq: 2\n}\n\nscript:pre-request {\n  bru.setVar("a", 1);\n}\n'},
    {path: 'orders/list.bru', content: request('List orders')},
    {path: 'orders/admin/refund.bru', content: request('Refund')},
    {path: 'users/get.bru', content: request('Get user')},
  ]
  const parsed = await parseBrunoManifest({collectionId: 'shop', mode: 'create', files})
  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.collectionName, 'Shop API')
  assert.deepEqual(parsed.folders, [{path: 'orders', name: 'Orders', seq: 2}, {path: 'users', name: 'users'}, {path: 'orders/admin', name: 'admin'}])
  const byPath = Object.fromEntries(parsed.requests.map(row => [row.path, row]))
  assert.equal(byPath['root.bru']!.folder, '')
  assert.equal(byPath['orders/admin/refund.bru']!.folder, 'orders/admin')
  assert.deepEqual(byPath['orders/admin/refund.bru']!.skipped, ['script'])
  assert.deepEqual(byPath['users/get.bru']!.skipped, [])
})

test('query params Bruno writes into both the URL and params:query are sent once', async () => {
  const content = request('Search', '\nparams:query {\n  limit: 10\n  q: {{term}}\n  ~page: 2\n}\n', 'http://127.0.0.1/search?limit=10&q={{term}}')
  const parsed = await parseBrunoManifest({collectionId: 'query', mode: 'create', files: [{path: 'search.bru', content}], variables: {term: 'kuma'}})
  assert.deepEqual(parsed.issues, [])
  const config = parsed.requests[0]!.config
  assert.equal(config.url, 'http://127.0.0.1/search')
  // Environment references stay native so the monitor follows later environment changes.
  assert.deepEqual(config.queryParams, [{name: 'limit', value: '10'}, {name: 'q', value: '{{term}}'}])
  // Without a params block the URL query is the only source and stays.
  const plain = await parseBrunoManifest({collectionId: 'query', mode: 'create', files: [{path: 'plain.bru', content: request('Plain', '', 'http://127.0.0.1/a?x=1')}]})
  assert.equal(plain.requests[0]!.config.url, 'http://127.0.0.1/a?x=1')
})

/** Rows shaped like stored monitors, sealed the way the database holds them. */
async function storedMonitor(fields: Record<string, any>) {
  const {monitorDbInput} = await import('../server/utils/monitor-secrets')
  return {...monitorDbInput({workspaceId: 1, environmentId: 1, type: 'http', method: 'GET', interval: 60, timeout: 30, maxRedirects: 10, authMethod: 'none', ...fields}), queryParams: undefined}
}

test('collection export follows Bruno conventions: folders from groups, env values, secrets by name, literal credentials become secrets', async () => {
  const {buildBrunoCollection} = await import('../server/services/bruno/collection-export')
  const monitors = [
    await storedMonitor({id: 1, name: 'Health', url: '{{baseUrl}}/health', groupId: null, assertions: {version: 1, mode: 'all', rules: [{id: 'a', source: 'status', operator: 'equals', expected: 200}]}}),
    await storedMonitor({id: 2, name: 'List orders', url: '{{baseUrl}}/orders', groupId: 10, headers: {authorization: 'Bearer LITERAL_TOKEN', 'x-trace': 'on'}, queryParams: [{name: 'limit', value: '5'}]}),
    await storedMonitor({id: 3, name: 'Refund', url: '{{baseUrl}}/refund', method: 'POST', groupId: 11, authMethod: 'basic', basicAuthUser: 'ops', basicAuthPass: 'LITERAL_PASSWORD', headers: {'content-type': 'application/json'}, body: '{"id":1}'}),
    {id: 4, name: 'Ping box', type: 'ping', hostname: '10.0.0.1', groupId: null, workspaceId: 1, environmentId: 1},
  ]
  const groups = [{id: 10, parentId: null, name: 'Orders', sortOrder: 1}, {id: 11, parentId: 10, name: 'Admin / Ops', sortOrder: 0}, {id: 12, parentId: null, name: 'Empty', sortOrder: 2}]
  const result = buildBrunoCollection({collectionName: 'Shop', monitors, groups, rootGroupId: null, environment: {name: 'prod', variables: {baseUrl: 'https://shop.example'}, secretNames: ['apiKey']}})
  const files = Object.fromEntries(result.files.map(file => [file.path, file.content]))
  assert.deepEqual(Object.keys(files).sort(), ['Health.bru', 'Orders/Admin - Ops/Refund.bru', 'Orders/Admin - Ops/folder.bru', 'Orders/List orders.bru', 'Orders/folder.bru', 'bruno.json', 'environments/prod.bru'])
  assert.equal(result.exported, 3)
  assert.deepEqual(result.skipped, [{id: 4, name: 'Ping box', reason: 'UNSUPPORTED_MONITOR_TYPE'}])
  const all = JSON.stringify(result.files)
  assert.ok(!all.includes('LITERAL_TOKEN') && !all.includes('LITERAL_PASSWORD'), 'literal credentials must not be written')
  assert.match(files['Orders/List orders.bru']!, /url: \{\{baseUrl\}\}\/orders\?limit=5/)
  assert.match(files['Orders/List orders.bru']!, /auth:bearer \{\n  token: \{\{list_orders_token\}\}/)
  assert.match(files['Orders/Admin - Ops/Refund.bru']!, /password: \{\{refund_password\}\}/)
  assert.match(files['environments/prod.bru']!, /baseUrl: https:\/\/shop\.example/)
  assert.match(files['environments/prod.bru']!, /vars:secret \[\n  apiKey,\n  list_orders_token,\n  refund_password\n\]/)
  assert.deepEqual(result.secretNames, ['list_orders_token', 'refund_password'])

  // Round trip: the exported collection imports again with the same request semantics.
  const parsed = await parseBrunoManifest({collectionId: 'shop', mode: 'create', sourceEnvironment: 'environments/prod.bru',
    files: result.files, secrets: {apiKey: 'k', list_orders_token: 't', refund_password: 'p'}})
  assert.deepEqual(parsed.issues, [])
  const byName = Object.fromEntries(parsed.requests.map(row => [row.name, row]))
  assert.deepEqual(parsed.folders.map(folder => folder.name), ['Orders', 'Admin / Ops'])
  assert.equal(byName['List orders']!.folder, 'Orders')
  assert.equal(byName['List orders']!.config.url, '{{baseUrl}}/orders')
  assert.deepEqual(byName['List orders']!.config.queryParams, [{name: 'limit', value: '5'}])
  assert.equal(byName['List orders']!.config.headers.authorization, 'Bearer {{list_orders_token}}')
  assert.equal(byName['Refund']!.config.basicAuthPass, '{{refund_password}}')
  assert.equal(JSON.parse(byName['Refund']!.config.body).id, 1)
  assert.equal(byName['Health']!.config.assertions.rules[0].expected, 200)
})

test('single request export keeps {{references}} and only replaces literal credentials', async () => {
  const {exportSingleRequest} = await import('../server/services/bruno/collection-export')
  const monitor = await storedMonitor({id: 7, name: 'Me', url: 'https://api.example/me', headers: {authorization: 'Bearer {{token}}', cookie: 'sid=LITERAL'}})
  const single = exportSingleRequest(monitor, {name: 'dev', variables: {}, secretNames: ['token']})
  assert.match(single.content, /token: \{\{token\}\}/)
  assert.match(single.content, /cookie: \{\{me_cookie\}\}/)
  assert.ok(!single.content.includes('LITERAL'))
  assert.deepEqual(single.secretNames, ['me_cookie'])
})

test('zip writer produces entries that standard inflate reads back with matching CRC', async () => {
  const {createZip} = await import('../server/utils/zip')
  const entries = [{path: 'Shop/bruno.json', content: '{"name":"Shop"}'}, {path: 'Shop/訂單/列表.bru', content: 'meta {\n  name: 列表\n}\n'.repeat(50)}]
  const zip = createZip(entries)
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  assert.equal(zip.readUInt16LE(end + 10), 2)
  let offset = zip.readUInt32LE(end + 16)
  for (const entry of entries) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50)
    const size = zip.readUInt32LE(offset + 20), nameLength = zip.readUInt16LE(offset + 28), local = zip.readUInt32LE(offset + 42)
    assert.equal(zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8'), entry.path)
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const data = inflateRawSync(zip.subarray(start, start + size))
    assert.equal(data.toString('utf8'), entry.content)
    assert.equal(zip.readUInt32LE(offset + 16), crc32(data) >>> 0)
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32)
  }
})
