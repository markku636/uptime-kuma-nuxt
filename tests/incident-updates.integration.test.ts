import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, scope: Scope
const slug = 'incident-updates-' + Date.now()

before(async () => {
  owner = await user('incident-updates')
  scope = await workspace(owner, 'Incident updates')
})
after(async () => { await cleanup([owner], [scope]) })

test('incident progress updates are persisted and exposed on the public status page', async () => {
  const page = await data(await request('/api/v1/status-pages', 'POST', owner, scope, { slug, title: 'Incident Updates' }))
  assert.equal(page.ok, true)
  const incident = await data(await request(`/api/v1/status-pages/${slug}/incidents`, 'POST', owner, scope, {
    title: 'API degraded', content: 'Elevated errors', style: 'warning', pin: true,
  }))
  assert.ok(incident.data.id)

  const path = `/api/v1/status-pages/${slug}/incidents/${incident.data.id}/updates`
  const invalid = await request(path, 'POST', owner, scope, { status: 'bogus', message: 'x' })
  assert.equal(invalid.status, 200) // unknown states fall back to "update"
  const empty = await request(path, 'POST', owner, scope, { message: '   ' })
  assert.equal(empty.status, 400)
  const created = await data(await request(path, 'POST', owner, scope, { status: 'identified', message: 'Root cause found' }))
  assert.equal(created.ok, true)
  assert.equal(created.data.status, 'identified')
  assert.equal(created.data.message, 'Root cause found')

  const publicPage = await data(await request(`/api/v1/status-pages/${slug}/monitors`))
  const listed = publicPage.data.incidents.find((row: any) => row.id === incident.data.id)
  assert.ok(listed)
  assert.deepEqual(listed.updates.map((row: any) => row.status), ['update', 'identified'])
  assert.equal(listed.updates[1].message, 'Root cause found')

  const feed = await fetch(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:32511'}/api/status/${slug}/rss`)
  assert.equal(feed.status, 200)
  const xml = await feed.text()
  assert.ok(xml.includes('API degraded'))
  assert.ok(xml.includes('Root cause found'))

  const publicPost = await request(path, 'POST', undefined, undefined, { message: 'unauthorized' })
  assert.equal(publicPost.status, 401)
})
