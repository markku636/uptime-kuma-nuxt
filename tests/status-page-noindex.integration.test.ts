import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, scope: Scope
const slug = 'noindex-' + Date.now()

before(async () => {
  owner = await user('noindex')
  scope = await workspace(owner, 'Noindex')
})
after(async () => { await cleanup([owner], [scope]) })

test('status page noindex setting persists and reaches the public config', async () => {
  const created = await data(await request('/api/v1/status-pages', 'POST', owner, scope, {
    slug, title: 'Noindex page', noIndex: true,
  }))
  assert.equal(created.ok, true)

  const config = await data(await request(`/api/v1/status-pages/${slug}/config`, 'GET', owner, scope))
  assert.equal(config.data.noIndex, true)

  const publicPage = await data(await request(`/api/v1/status-pages/${slug}/monitors`))
  assert.equal(publicPage.data.config.noIndex, true)

  await data(await request(`/api/v1/status-pages/${slug}`, 'PUT', owner, scope, { noIndex: false }))
  const afterUpdate = await data(await request(`/api/v1/status-pages/${slug}/monitors`))
  assert.equal(afterUpdate.data.config.noIndex, false)
})
