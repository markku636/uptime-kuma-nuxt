import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {user,workspace,cleanup,request,data,type Identity,type Scope} from './helpers/http'

test('a Bruno trial evaluates every supported assertion family end to end', {timeout:30000}, async () => {
  let identity: Identity | undefined, scope: Scope | undefined
  const fixture = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.setHeader('x-mode', 'ready')
    res.end(JSON.stringify({ok: true, name: 'alpha', count: 3, active: true, tags: ['a', 'b'], nested: {id: 7}}))
  })
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve))
  const origin = `http://127.0.0.1:${(fixture.address() as any).port}`
  try {
    identity = await user('bruno-assertions-e2e')
    scope = await workspace(identity, 'Bruno assertions e2e')
    const body = `meta {
  name: All assertions
  type: http
}

get {
  url: ${origin}/payload
  body: none
  auth: none
}

assert {
  res.status: eq 200
  res.status: ne 500
  res.status: gte 200
  res.status: lte 299
  res.status: between 200 299
  res.status: in [200,201]
  res.status: notIn [404,500]
  res.responseTime: lt 5000
  res.headers.X-Mode: eq "ready"
  res.headers.X-Mode: contains "rea"
  res.text: contains "alpha"
  res.headers.Content-Type: startsWith "application"
  res.text: notMatches "^[0-9]+$"
  res.body.name: eq "alpha"
  res.body.name: notIn ["beta"]
  res.body.count: gt 2
  res.body.count: lte 3
  res.body.nested.id: eq 7
  res.body.tags: length 2
  res.body.active: isTruthy
  res.body.missing: isUndefined
  res.body.name: isString
  res.body.tags: isArray
}
`
    const trial = await data(await request('/api/v1/monitors/test', 'POST', identity, scope, {
      type: 'bruno', name: 'All assertions', active: false, timeout: 30, body,
    }))
    assert.equal(trial.ok, true)
    assert.equal(trial.data.status, 1, JSON.stringify(trial.data))
    assert.equal(trial.data.code, 'CHECK_OK')
    assert.equal(trial.data.assertionResults.rules.length, 23)
    assert.deepEqual(trial.data.assertionResults.rules.filter((rule: any) => !rule.passed), [])
    assert.equal(trial.data.assertionResults.rules[0]!.actual, 200)
    assert.ok(trial.data.assertionResults.rules.filter((rule: any) => rule.actual !== undefined).length >= 20)
  } finally {
    fixture.closeAllConnections()
    await new Promise<void>(resolve => fixture.close(() => resolve()))
    if (identity && scope) await cleanup([identity], [scope])
  }
})
