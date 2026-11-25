import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {
  checkBruno,
  clampTrialResponse,
  TRIAL_RESPONSE_MAX_BODY_BYTES,
  TRIAL_RESPONSE_MAX_HEADER_VALUE_BYTES,
} from '../server/services/monitor/checkers/bruno-checker'
import { closeHttpAgents } from '../server/services/monitor/checkers/http-request'
import { trialMonitor } from '../server/utils/monitor-trial'

let server: http.Server, base: string

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/large') {
      const headers: Record<string, string> = {}
      for (let i = 0; i < 60; i++) headers[`x-h-${i}`] = i === 0 ? 'v'.repeat(5000) : 'v'
      res.writeHead(200, { 'content-type': 'text/plain', 'x-marker': 'trial-marker', ...headers })
      res.end('A'.repeat(TRIAL_RESPONSE_MAX_BODY_BYTES + 4096) + 'TAIL')
    } else {
      res.writeHead(200, { 'content-type': 'application/json', 'x-marker': 'trial-marker' })
      res.end(JSON.stringify({ ok: true, marker: 'trial-body' }))
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as any).port}`
})

after(async () => {
  closeHttpAgents()
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
})

const source = (path: string) => `meta {\n name: Trial\n type: http\n}\nget {\n url: ${base}${path}\n body: none\n auth: none\n}\nassert {\n res.status: eq 200\n}\n`
const monitor = (path: string, trial = false) => ({ type: 'bruno', name: 'Trial', body: source(path), timeout: 5, ...(trial ? { includeTrialResponse: true } : {}) })

test('scheduled Bruno check returns UP with no response even when the HTTP response has a body and headers', async () => {
  const result = await checkBruno(monitor('/'), Date.now())
  assert.equal(result.status, 1)
  assert.ok(!('response' in result))
})

test('trial Bruno check includes bounded status, headers, body, elapsed and assertion results', async () => {
  const result = await checkBruno(monitor('/', true), Date.now())
  assert.equal(result.status, 1)
  assert.equal(result.assertionResults?.rules.length, 1)
  assert.equal(result.response?.status, 200)
  assert.equal(result.response?.headers['x-marker'], 'trial-marker')
  assert.match(result.response!.body, /trial-body/)
  assert.equal(typeof result.response?.elapsed, 'number')
  assert.equal(result.response?.truncated, undefined)
})

test('trial response clamps a >64 KiB body, 60 headers and a >4 KiB header value', async () => {
  const result = await checkBruno(monitor('/large', true), Date.now())
  assert.equal(result.status, 1)
  const response = result.response!
  assert.equal(response.truncated, true)
  assert.ok(Buffer.byteLength(response.body, 'utf8') <= TRIAL_RESPONSE_MAX_BODY_BYTES)
  assert.equal(Object.keys(response.headers).length, 50)
  assert.ok(Buffer.byteLength(response.headers['x-h-0']!, 'utf8') <= TRIAL_RESPONSE_MAX_HEADER_VALUE_BYTES)
  assert.ok(Buffer.byteLength(Object.values(response.headers).join(''), 'utf8') < TRIAL_RESPONSE_MAX_BODY_BYTES)
})

test('pure clamp helper keeps multibyte text valid and is idempotent', () => {
  const response = { status: 200, headers: { 'x-value': 'h'.repeat(5000) }, body: '😀'.repeat(40000), elapsed: 12 }
  const clamped = clampTrialResponse(response)
  assert.equal(clamped.truncated, true)
  assert.ok(Buffer.byteLength(clamped.body, 'utf8') <= TRIAL_RESPONSE_MAX_BODY_BYTES)
  assert.equal(clamped.body.endsWith('\ufffd'), false)
  assert.ok(Buffer.byteLength(clamped.headers['x-value']!, 'utf8') <= TRIAL_RESPONSE_MAX_HEADER_VALUE_BYTES)
  assert.deepEqual(clampTrialResponse(clamped), clamped)

  const small = clampTrialResponse({ status: 404, headers: { 'x-ok': 'yes' }, body: 'no', elapsed: 3 })
  assert.deepEqual(small, { status: 404, headers: { 'x-ok': 'yes' }, body: 'no', elapsed: 3 })
})

test('trialMonitor opts into the response and returns only trial fields (no history or notification writes)', async () => {
  const calls: any[] = []
  const fakeChecker = async (m: any) => {
    calls.push(m)
    return {
      status: 1, ping: 7, msg: 'Check passed', code: 'CHECK_OK',
      assertionResults: { version: 1, mode: 'all', rules: [], passed: true },
      response: { status: 200, headers: { 'x-marker': 'trial-marker' }, body: 'trial-body', elapsed: 7 },
    }
  }
  const result = await trialMonitor(920001, monitor('/'), fakeChecker)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].includeTrialResponse, true)
  assert.deepEqual(Object.keys(result.data).sort(), ['assertionResults', 'code', 'msg', 'ping', 'response', 'status'])
  assert.equal(result.data.response?.body, 'trial-body')

  const withoutResponse = await trialMonitor(920002, monitor('/'), async () => ({ status: 0, ping: 1, msg: 'Check failed', code: 'CHECK_OK' }))
  assert.ok(!('response' in withoutResponse.data))
})
