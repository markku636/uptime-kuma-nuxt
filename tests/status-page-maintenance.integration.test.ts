import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, scope: Scope
const slug = 'maint-page-' + Date.now()

before(async () => {
  owner = await user('maint-page')
  scope = await workspace(owner, 'Maintenance page')
})
after(async () => { await cleanup([owner], [scope]) })

test('public status page exposes linked scheduled maintenance without auth', async () => {
  const page = await data(await request('/api/v1/status-pages', 'POST', owner, scope, { slug, title: 'Maintenance page' }))
  const start = new Date(Date.now() + 3600_000).toISOString()
  const end = new Date(Date.now() + 7200_000).toISOString()
  const maintenance = await data(await request('/api/v1/maintenances', 'POST', owner, scope, {
    title: 'Planned upgrade', description: 'Database migration', strategy: 'single',
    startDate: start, endDate: end, statusPageIds: [page.data.id],
  }))
  assert.ok(maintenance.data.id)

  const publicList = await data(await request(`/api/v1/status-pages/${slug}/maintenances`))
  assert.equal(publicList.ok, true)
  const row = publicList.data.find((item: any) => item.id === maintenance.data.id)
  assert.ok(row)
  assert.equal(row.title, 'Planned upgrade')
  assert.ok(['scheduled', 'under-maintenance'].includes(row.status))
  assert.equal(row.timeslotList[0].startDate, start)

  const missing = await request('/api/v1/status-pages/not-a-real-page/maintenances')
  assert.equal(missing.status, 404)
})
