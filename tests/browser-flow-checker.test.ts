import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkBrowserFlow } from '../server/services/monitor/checkers/browser-flow-checker'
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
    async waitForSelector() { return true },
    locator(selector: string) {
      const first = () => ({
        count: async () => state[selector] === undefined ? 0 : 1,
        isVisible: async () => true,
        textContent: async () => state[selector] ?? '',
        inputValue: async () => state[selector] ?? '',
      })
      return { first }
    },
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

test('invalid config and missing URL fail before launching the browser', async () => {
  const page = fakePage()
  const badConfig = await checkBrowserFlow({ url: 'https://example.com', body: 'not json' }, Date.now(), undefined, deps(page))
  assert.equal(badConfig.code, 'CONFIG_ERROR')
  const noUrl = await checkBrowserFlow({ body: '{"steps":[{"action":"goto"}]}' }, Date.now(), undefined, deps(page))
  assert.equal(noUrl.code, 'CONFIG_ERROR')
})
