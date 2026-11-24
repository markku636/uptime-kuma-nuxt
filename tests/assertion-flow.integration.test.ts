import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { chromium } from 'playwright'
import { base, user, workspace, cleanup, prisma, type Identity, type Scope } from './helpers/http'

function fixtureServer() {
  const server = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ success: true, ok: 'ready' }))
  })
  return new Promise<{ server: http.Server; port: number }>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as any).port }))
  })
}

async function setupBrowser() {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const identity: Identity = await user('assertion-flow')
  const scope: Scope = await workspace(identity, 'Assertion flow')
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const cookies = identity.cookie.split('; ').map(part => {
    const separator = part.indexOf('=')
    return { name: part.slice(0, separator), value: part.slice(separator + 1), url: base }
  })
  await context.addCookies([
    ...cookies,
    { name: 'workspace_id', value: String(scope.workspaceId), url: base },
    { name: 'environment_id', value: String(scope.environmentId), url: base },
  ])
  await context.route('**/*', route => ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  return { browser, identity, scope, context }
}

test('assertion presets, custom rules and any/all mode are stored as typed JSON', { timeout: 90000 }, async () => {
  const { server, port } = await fixtureServer()
  const { browser, identity, scope, context } = await setupBrowser()
  let monitorId: number | undefined
  try {
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + '/monitors/add')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Create Monitor' && !button.disabled))
    await page.getByPlaceholder('My Monitor', { exact: true }).fill('Assertion flow monitor')
    await page.getByPlaceholder('https://example.com', { exact: true }).fill(`http://127.0.0.1:${port}/`)

    await page.getByLabel('Quick add').selectOption({ label: 'Status is 200' })
    await page.getByRole('button', { name: 'Test request and assertions', exact: true }).click()
    await page.getByText('Assertions: Passed', { exact: true }).waitFor({ timeout: 8000 })

    await page.getByRole('button', { name: /Add custom rule/ }).click()
    await page.getByRole('button', { name: 'Test request and assertions', exact: true }).click()
    await page.getByText('Assertions: Passed', { exact: true }).waitFor({ timeout: 8000 })

    const expected = page.getByLabel('Expected JSON value').nth(1)
    await expected.fill('false')
    await page.getByRole('button', { name: 'Test request and assertions', exact: true }).click()
    await page.getByText('Assertions: Failed', { exact: true }).waitFor({ timeout: 8000 })

    await page.getByLabel('Pass when').selectOption('any')
    await page.getByRole('button', { name: 'Test request and assertions', exact: true }).click()
    await page.getByText('Assertions: Passed', { exact: true }).waitFor({ timeout: 8000 })

    await page.getByRole('button', { name: 'Create Monitor', exact: true }).click()
    await page.waitForURL(/\/monitors\/\d+$/)
    monitorId = Number(new URL(page.url()).pathname.split('/').at(-1))
    const record = await prisma.monitor.findUniqueOrThrow({ where: { id: monitorId } })
    const assertions = record.assertions as any
    assert.equal(assertions.version, 1)
    assert.equal(assertions.mode, 'any')
    assert.equal(assertions.rules.length, 2)
    assert.deepEqual(assertions.rules.map((rule: any) => rule.source).sort(), ['json', 'status'])
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    if (monitorId) await prisma.monitor.deleteMany({ where: { id: monitorId } }).catch(() => {})
    await cleanup([identity], [scope])
  }
})

test('invalid assertion values block saving and response-time assertions evaluate', { timeout: 90000 }, async () => {
  const { server, port } = await fixtureServer()
  const { browser, identity, scope, context } = await setupBrowser()
  try {
    const page = await context.newPage()
    await page.goto(base + '/monitors/add')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Create Monitor' && !button.disabled))
    await page.getByPlaceholder('My Monitor', { exact: true }).fill('Response time assertion')
    await page.getByPlaceholder('https://example.com', { exact: true }).fill(`http://127.0.0.1:${port}/`)
    await page.getByLabel('Quick add').selectOption({ label: 'Response time under 500 ms' })

    const create = page.getByRole('button', { name: 'Create Monitor', exact: true })
    await page.getByLabel('Expected JSON value').fill('not-json')
    assert.equal(await create.isDisabled(), true)
    await page.getByLabel('Expected JSON value').fill('-1')
    assert.equal(await create.isDisabled(), false)
    await page.getByRole('button', { name: 'Test request and assertions', exact: true }).click()
    await page.getByText('Assertions: Failed', { exact: true }).waitFor({ timeout: 8000 })

    await page.getByLabel('Expected JSON value').fill('500')
    await page.getByRole('button', { name: 'Test request and assertions', exact: true }).click()
    await page.getByText('Assertions: Passed', { exact: true }).waitFor({ timeout: 8000 })
  } finally {
    await browser.close()
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await cleanup([identity], [scope])
  }
})
