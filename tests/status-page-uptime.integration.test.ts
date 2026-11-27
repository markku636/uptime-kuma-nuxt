import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, scope: Scope
const slug = 'uptime-windows-' + Date.now()

before(async () => {
  owner = await user('uptime-windows')
  scope = await workspace(owner, 'Uptime windows')
})
after(async () => { await cleanup([owner], [scope]) })

test('public heartbeat feed exposes 24h, 7d and 30d uptime windows', async () => {
  const monitor = await data(await request('/api/v1/monitors', 'POST', owner, scope, {
    name: 'Window monitor', type: 'http', url: 'http://127.0.0.1:9/health',
  }))
  await data(await request('/api/v1/status-pages', 'POST', owner, scope, { slug, title: 'Windows', monitors: [monitor.data.id] }))

  const feed = await data(await request(`/api/v1/status-pages/${slug}/heartbeat?monitorIds=${monitor.data.id}`))
  for (const key of ['24', '7', '30']) {
    assert.ok(Object.hasOwn(feed.data.uptimeList, `${monitor.data.id}_${key}`), `missing ${key}d window`)
  }
})
