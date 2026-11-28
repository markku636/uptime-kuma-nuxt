import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkBrowserFlow, defaultDeps, assertPublicUrl } from '../server/services/monitor/checkers/browser-flow-checker'
import { parseBrowserFlowConfig } from '../server/utils/browser-flow-config'

function fakePage() {
  const state: Record<string, string> = { '#title': 'Welcome home', '#email': '' }
  const clicks: string[] = []
  return {
    state, clicks,
    setDefaultTimeout() {},
    async goto() { return { status: () => 200 } },
    async click(selector: string) { clicks.push(selector) },
    async fill(selector: string, value: string) { state[selector] = value },
    async selectOption(selector: string, value: string) { state[selector] = value },
    async check(selector: string) { state[selector] = 'checked' },
    async uncheck(selector: string) { state[selector] = '' },
    async waitForSelector() { return true },
    locator(selector: string) {
      const first = () => ({
        count: async () => state[selector] === undefined ? 0 : 1,
        isVisible: async () => true,
        textContent: async () => state[selector] ?? '',
        inputValue: async () => state[selector] ?? '',
        isChecked: async () => state[selector] === 'checked',
      })
      return { first, count: async () => state[selector] === undefined ? 0 : 1 }
    },
    async screenshot() { return Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    async close() {},
  }
}
function deps(page: ReturnType<typeof fakePage>) {
  return {
    parse: parseBrowserFlowConfig,
    launch: async () => ({ newContext: async () => ({ newPage: async () => page }), close: async () => {} }),
    resolve: async () => {},
  }
}

test('browser flow config rejects unknown actions and missing selectors', () => {
  assert.throws(() => parseBrowserFlowConfig(JSON.stringify({ steps: [{ action: 'eval', value: 'alert(1)' }] })))
  assert.throws(() => parseBrowserFlowConfig(JSON.stringify({ steps: [{ action: 'click' }] })))
  assert.throws(() => parseBrowserFlowConfig(JSON.stringify({ steps: [{ action: 'fill', selector: '#a' }] })))
  const parsed = parseBrowserFlowConfig(JSON.stringify({ steps: [{ action: 'goto' }] }))
  assert.equal(parsed.viewport.width, 1440)
  assert.equal(parsed.waitTimeoutMs, 5000)
})

test('browser flow executes ordered steps and reports each one', async () => {
  const page = fakePage()
  const config = {
    steps: [
      { action: 'goto' },
      { action: 'fill', selector: '#email', value: 'me@example.com' },
      { action: 'click', selector: '#submit' },
      { action: 'waitFor', selector: '#title' },
      { action: 'assertVisible', selector: '#title' },
      { action: 'assertText', selector: '#title', value: 'Welcome' },
      { action: 'assertValue', selector: '#email', value: 'me@example.com' },
    ],
  }
  const result = await checkBrowserFlow({ url: 'https://example.com', body: JSON.stringify(config) }, Date.now(), undefined, deps(page))
  assert.equal(result.status, 1)
  assert.equal(result.code, 'FLOW_OK')
  assert.equal(result.flowSteps?.length, 7)
  assert.equal(result.flowSteps?.every(step => step.status === 'pass'), true)
  assert.equal(page.state['#email'], 'me@example.com')
  assert.deepEqual(page.clicks, ['#submit'])
})

test('form controls and checked assertions are supported', async () => {
  const page = fakePage()
  const config = {
    steps: [
      { action: 'goto' },
      { action: 'selectOption', selector: '#country', value: 'TW' },
      { action: 'assertValue', selector: '#country', value: 'TW' },
      { action: 'check', selector: '#agree' },
      { action: 'assertChecked', selector: '#agree' },
      { action: 'uncheck', selector: '#agree' },
    ],
  }
  const result = await checkBrowserFlow({ url: 'https://example.com', body: JSON.stringify(config) }, Date.now(), undefined, deps(page))
  assert.equal(result.status, 1)
  assert.equal(result.code, 'FLOW_OK')
  assert.equal(result.flowSteps?.length, 6)
  const bad = { steps: [{ action: 'goto' }, { action: 'assertChecked', selector: '#agree' }] }
  const failed = await checkBrowserFlow({ url: 'https://example.com', body: JSON.stringify(bad) }, Date.now(), undefined, deps(page))
  assert.equal(failed.code, 'FLOW_STEP_FAILED')
  assert.match(failed.msg, /NOT_CHECKED/)
})

test('scheduled passes save a step trace but trials do not', async () => {
  const page = fakePage()
  const traces: any[] = []
  const withTrace = { ...deps(page), saveTrace: async (id: number, metrics: any) => { traces.push({ id, metrics }) } }
  const config = { steps: [{ action: 'goto' }, { action: 'assertVisible', selector: '#title' }] }
  await checkBrowserFlow({ id: 11, url: 'https://example.com', body: JSON.stringify(config) }, Date.now(), undefined, withTrace)
  assert.equal(traces.length, 1)
  assert.equal(traces[0].id, 11)
  assert.equal(traces[0].metrics.code, 'FLOW_OK')
  assert.equal(traces[0].metrics.flowSteps.length, 2)
  await checkBrowserFlow({ id: 11, url: 'https://example.com', body: JSON.stringify(config), includeTrialResponse: true }, Date.now(), undefined, withTrace)
  assert.equal(traces.length, 1)
})

test('assertCount compares element count and rejects non-numeric values', async () => {
  const page = fakePage()
  const good = { steps: [{ action: 'goto' }, { action: 'assertCount', selector: '#title', value: '1' }] }
  const result = await checkBrowserFlow({ url: 'https://example.com', body: JSON.stringify(good) }, Date.now(), undefined, deps(page))
  assert.equal(result.code, 'FLOW_OK')
  const bad = { steps: [{ action: 'goto' }, { action: 'assertCount', selector: '#title', value: '2' }] }
  const failed = await checkBrowserFlow({ url: 'https://example.com', body: JSON.stringify(bad) }, Date.now(), undefined, deps(page))
  assert.match(failed.msg, /COUNT_MISMATCH:1/)
})

test('failed assertion stops the flow and identifies the step', async () => {
  const page = fakePage()
  const config = { steps: [{ action: 'goto' }, { action: 'assertText', selector: '#title', value: 'Goodbye' }, { action: 'click', selector: '#submit' }] }
  const result = await checkBrowserFlow({ url: 'https://example.com', body: JSON.stringify(config) }, Date.now(), undefined, deps(page))
  assert.equal(result.status, 0)
  assert.equal(result.code, 'FLOW_STEP_FAILED')
  assert.match(result.msg, /Step 2\/3/)
  assert.equal(result.flowSteps?.length, 2)
  assert.equal(result.flowSteps?.[1]?.detail, 'TEXT_MISMATCH')
  assert.deepEqual(page.clicks, [])
})

test('zero step timeout is rejected (Playwright treats 0 as no timeout)', () => {
  assert.throws(() => parseBrowserFlowConfig(JSON.stringify({ steps: [{ action: 'waitFor', selector: '#x', timeoutMs: 0 }] })))
})

test('public URL guard denies loopback, private and metadata destinations', async () => {
  for (const url of ['http://127.0.0.1/', 'http://10.0.0.5/', 'http://169.254.169.254/latest/meta-data/', 'http://metadata.google.internal/']) {
    await assert.rejects(() => assertPublicUrl(url), /DENIED/)
  }
  assert.equal(typeof defaultDeps.resolve, 'function')
})

test('default dependencies include the failure artifact writer', () => {
  assert.equal(typeof defaultDeps.saveFailure, 'function')
})

test('scheduled failures save one screenshot artifact; trials do not', async () => {
  const page = fakePage()
  const saved: any[] = []
  const config = { steps: [{ action: 'goto' }, { action: 'assertText', selector: '#title', value: 'nope' }] }
  const depsWithSave = { ...deps(page), saveFailure: async (artifact: any) => { saved.push(artifact) } }
  const scheduled = await checkBrowserFlow({ id: 7, url: 'https://example.com', body: JSON.stringify(config) }, Date.now(), undefined, depsWithSave)
  assert.equal(scheduled.status, 0)
  assert.equal(saved.length, 1)
  assert.equal(saved[0].monitorId, 7)
  assert.equal(saved[0].viewportLabel, 'flow-fail')
  assert.equal(saved[0].metrics.code, 'FLOW_STEP_FAILED')

  await checkBrowserFlow({ id: 7, url: 'https://example.com', body: JSON.stringify(config), includeTrialResponse: true }, Date.now(), undefined, depsWithSave)
  assert.equal(saved.length, 1)
})

test('invalid config and missing URL fail before launching the browser', async () => {
  const page = fakePage()
  const badConfig = await checkBrowserFlow({ url: 'https://example.com', body: 'not json' }, Date.now(), undefined, deps(page))
  assert.equal(badConfig.code, 'CONFIG_ERROR')
  const noUrl = await checkBrowserFlow({ body: '{"steps":[{"action":"goto"}]}' }, Date.now(), undefined, deps(page))
  assert.equal(noUrl.code, 'CONFIG_ERROR')
})
