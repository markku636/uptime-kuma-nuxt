import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, scope: Scope
const custom = {
  key: 'custom-test-rule', source: 'Custom', sourceUrl: 'https://nvd.nist.gov/', product: 'TestProduct',
  signature: 'testproduct', maxVersion: '1.0.0', severity: 'low', title: 'Test rule', detail: 'Test detail',
  recommendation: 'Upgrade', refs: [], cwe: [], active: true,
}

before(async () => { owner = await user('sec-rules'); scope = await workspace(owner, 'Security rules') })
after(async () => { await cleanup([owner], [scope]) })

test('security rules can be updated from curated sources, maintained and exported', async () => {
  const updated = await data(await request('/api/v1/security-rules/update', 'POST', owner, scope))
  assert.ok(updated.created >= 5)
  const list = await data(await request('/api/v1/security-rules', 'GET', owner, scope))
  assert.ok(list.data.some((rule: any) => rule.source === 'NVD'))
  assert.ok(list.data.some((rule: any) => rule.source === 'CISA KEV'))
  assert.ok(list.data.every((rule: any) => rule.sourceUrl))

  const created = await data(await request('/api/v1/security-rules', 'POST', owner, scope, custom))
  assert.equal(created.data.key, custom.key)
  const patched = await data(await request(`/api/v1/security-rules/${created.data.id}`, 'PUT', owner, scope, { ...custom, active: false }))
  assert.equal(patched.data.active, false)
  const imported = await data(await request('/api/v1/security-rules/import', 'POST', owner, scope, { rules: [custom] }))
  assert.equal(imported.imported, 0) // duplicate key skipped

  const exported = await (await request('/api/v1/security-rules/export', 'GET', owner, scope)).text()
  assert.ok(exported.includes('custom-test-rule'))
  assert.ok(exported.includes('https://nvd.nist.gov/'))

  assert.equal((await request(`/api/v1/security-rules/${created.data.id}`, 'DELETE', owner, scope)).status, 200)
  assert.equal((await request('/api/v1/security-rules/update', 'POST', undefined, scope)).status, 401)
})
