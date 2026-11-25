import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { chromium } from 'playwright'
import { base, user, workspace, cleanup, prisma, type Identity, type Scope } from './helpers/http'

test('browser creates a Bruno monitor with its .bru body and trials it', { timeout: 60000 }, async () => {
  let identity: Identity | undefined, scope: Scope | undefined, monitorId: number | undefined
  const fixture = http.createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ success: true }))
  })
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  try {
    identity = await user('bruno-create')
    scope = await workspace(identity, 'Bruno create')
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
    const page = await context.newPage()
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    let trialBody = ''
    page.on('request', request => {
      if (request.url().endsWith('/api/v1/monitors/test')) trialBody = request.postData() || ''
    })

    const bru = `meta {
  name: Fixture
  type: http
  seq: 1
}

get {
  url: http://127.0.0.1:${(fixture.address() as any).port}/
  body: none
  auth: none
}

assert {
  res.status: eq 200
}
`
    await page.goto(base + '/monitors/add')
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === 'Create Monitor' && !button.disabled))
    await page.locator('select.select-field').first().selectOption('bruno')
    await page.getByPlaceholder('My Monitor', { exact: true }).fill('Browser Bruno created')
    await page.locator('textarea.font-mono').first().fill(bru)

    await page.getByRole('button', { name: 'Send request', exact: true }).click()
    await page.waitForFunction(() => document.body.innerText.includes('Check passed') || document.body.innerText.includes('Check failed'), undefined, { timeout: 8000 }).catch(async () => {
      console.info('BRUNO TRIAL PAGE', (await page.locator('form').innerText()).slice(-1500))
    })
    assert.ok(JSON.parse(trialBody).body?.includes('res.status'), 'trial must send the .bru body')

    await page.getByRole('button', { name: 'Create Monitor', exact: true }).click()
    await page.waitForURL(/\/monitors\/\d+$/)
    monitorId = Number(new URL(page.url()).pathname.split('/').at(-1))
    const record = await prisma.monitor.findUniqueOrThrow({ where: { id: monitorId } })
    assert.equal(record.type, 'bruno')
    assert.ok(record.requestSecrets, 'the .bru body must be sealed on create')
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    fixture.closeAllConnections()
    await new Promise<void>(resolve => fixture.close(() => resolve()))
    if (monitorId) await prisma.monitor.deleteMany({ where: { id: monitorId } }).catch(() => {})
    if (identity && scope) await cleanup([identity], [scope])
  }
})
