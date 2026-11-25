import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {chromium} from 'playwright'
import {base,user,workspace,cleanup,request,data,type Identity,type Scope} from './helpers/http'

const requestSource = (origin: string) => `meta {
  name: Editor Bruno
  type: http
}

get {
  url: ${origin}/health
  body: none
  auth: none
}

assert {
  res.status: eq 200
}
`

test('browser edits a Bruno request with the tabbed editor, saves and tests it', {timeout:90000}, async () => {
  let identity: Identity | undefined, scope: Scope | undefined, monitorId: number | undefined, hits = 0
  const fixture = http.createServer(async (req, res) => {
    hits++
    res.setHeader('content-type', 'application/json')
    res.setHeader('x-fixture', 'ready')
    res.end(JSON.stringify({ok: true, path: req.url}))
  })
  await new Promise<void>(r => fixture.listen(0, '127.0.0.1', r))
  const origin = `http://127.0.0.1:${(fixture.address() as any).port}`
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--disable-dev-shm-usage']})
  try {
    identity = await user('bruno-editor-browser')
    scope = await workspace(identity, 'Bruno Editor Browser')
    const created = await data(await request('/api/v1/monitors', 'POST', identity, scope, {
      type: 'bruno', name: 'Editor Bruno', active: false, body: requestSource(origin),
    }))
    monitorId = created.data.id

    const context = await browser.newContext({viewport:{width:1440,height:1100}})
    const cookies = identity.cookie.split('; ').map(part => { const index = part.indexOf('='); return {name:part.slice(0,index),value:part.slice(index+1),url:base} })
    await context.addCookies([...cookies,
      {name:'workspace_id',value:String(scope.workspaceId),url:base},
      {name:'environment_id',value:String(scope.environmentId),url:base},
    ])
    await context.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    const page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto(`${base}/monitors/${monitorId}/edit`)
    // UI editor is the default view now.
    await page.getByRole('tab', {name:/Params/}).waitFor()
    await page.getByRole('button', {name:'Raw (.bru)', exact:true}).click()
    const raw = page.locator('textarea.font-mono').first()
    assert.match(await raw.inputValue(), /res\.status: eq 200/, 'existing .bru source must be visible to editors')
    assert.match(await raw.inputValue(), new RegExp(origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

    await page.getByRole('button', {name:'UI editor', exact:true}).click()
    await page.getByRole('tab', {name:/Params/}).waitFor()
    await page.getByRole('button', {name:'+ Add parameter', exact:true}).click()
    await page.getByPlaceholder('Name').last().fill('token')
    await page.getByPlaceholder('Value').last().fill('demo')

    await page.getByRole('button', {name:'Bulk Edit', exact:true}).click()
    const bulk = page.locator('textarea[placeholder="name: value"]')
    assert.match(await bulk.inputValue(), /token: demo/)
    await bulk.fill('token: demo2\n~off: no')
    await page.getByRole('button', {name:'Table Edit', exact:true}).click()
    const paramTable = page.locator('table.bruno-table').first()
    assert.equal(await paramTable.getByPlaceholder('Name').first().inputValue(), 'token')
    assert.equal(await paramTable.getByPlaceholder('Value').first().inputValue(), 'demo2')

    await page.getByRole('tab', {name:/Headers/}).click()
    await page.getByRole('button', {name:'+ Add header', exact:true}).click()
    await page.getByPlaceholder('Name').last().fill('X-Demo')
    await page.getByPlaceholder('Value').last().fill('abc')

    await page.getByRole('tab', {name:/Vars/}).click()
    await page.getByRole('button', {name:'Edit environment variables', exact:true}).click()
    const dialog = page.getByRole('dialog')
    await dialog.waitFor()
    assert.match(await dialog.innerText(), /environment/i)
    await dialog.getByPlaceholder('VARIABLE_NAME').first().fill('EDITOR_VAR')
    await dialog.getByPlaceholder('value', {exact:true}).first().fill('from-editor')
    await dialog.getByRole('button', {name:/Save/i}).first().click()
    await dialog.getByText(/reschedul/i).waitFor()
    await dialog.getByRole('button', {name:'Close', exact:true}).first().click()
    await dialog.waitFor({state:'hidden'})

    await page.getByRole('tab', {name:/Vars/}).click()
    await page.getByText('{{EDITOR_VAR}}').waitFor()
    await page.getByRole('button', {name:'+ Add variable', exact:true}).click()
    const varValue = page.locator('table.bruno-table input[placeholder="Value"]').first()
    await varValue.click()
    await page.getByRole('button', {name:'Insert', exact:true}).first().click()
    assert.match(await varValue.inputValue(), /\{\{EDITOR_VAR\}\}/)

    await page.getByRole('tab', {name:/Params/}).click()
    const urlField = page.getByPlaceholder('https://example.com/health', {exact:true})
    await urlField.click()
    await urlField.press('End')
    await urlField.type('{{ED')
    await page.getByRole('option', {name:/EDITOR_VAR/}).click()
    assert.match(await urlField.inputValue(), /\{\{EDITOR_VAR\}\}$/)
    await urlField.fill((await urlField.inputValue()).replace('{{EDITOR_VAR}}', ''))

    await page.getByRole('tab', {name:/Assert/}).click()
    assert.ok((await page.locator('select.bruno-cell').count()) > 0, 'assertion operator selector is rendered')

    await page.getByRole('tab', {name:/Auth/}).click()
    await page.getByLabel('Auth mode').selectOption('bearer')
    await page.getByLabel('Token').fill('demo-token')
    await page.getByRole('tab', {name:/Docs/}).click()
    await page.getByLabel('Docs').fill('# Demo doc')

    await page.getByRole('button', {name:'Raw (.bru)', exact:true}).click()
    await page.waitForFunction(() => (document.querySelector('textarea.font-mono') as HTMLTextAreaElement | null)?.value?.includes('X-Demo'))
    const edited = await raw.inputValue()
    assert.match(edited, /token: demo2/)
    assert.match(edited, /~off: no/)
    assert.match(edited, /X-Demo: abc/)
    assert.match(edited, /auth: bearer/)
    assert.match(edited, /token: demo-token/)
    assert.match(edited, /# Demo doc/)

    await page.getByRole('button', {name:'UI editor', exact:true}).click()
    await page.getByRole('tab', {name:/Params/}).waitFor()
    await page.getByPlaceholder('https://example.com/health', {exact:true}).focus()
    await page.keyboard.press('Control+Enter')
    await page.getByText(/Status\s*200/).waitFor()
    assert.equal(hits, 1)

    await page.getByRole('button', {name:'Save Monitor', exact:true}).click()
    await page.waitForURL(/\/monitors$/)
    const saved = await data(await request(`/api/v1/monitors/${monitorId}`, 'GET', identity, scope))
    assert.match(saved.data.body, /X-Demo: abc/, 'PUT persisted the serialized .bru')

    await page.goto(`${base}/monitors/${monitorId}/edit`)
    await page.getByRole('tab', {name:/Params/}).waitFor()
    await page.getByRole('button', {name:'Raw (.bru)', exact:true}).click()
    assert.match(await page.locator('textarea.font-mono').first().inputValue(), /X-Demo: abc/, 'saved .bru survives reload')
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    fixture.closeAllConnections()
    await new Promise<void>(r => fixture.close(() => r()))
    if (identity && scope) await cleanup([identity], [scope])
  }
})

test('browser opens an empty Bruno request directly in the UI editor', {timeout:60000}, async () => {
  let identity: Identity | undefined, scope: Scope | undefined, monitorId: number | undefined
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--disable-dev-shm-usage']})
  try {
    identity = await user('bruno-empty-ui')
    scope = await workspace(identity, 'Bruno empty UI')
    const created = await data(await request('/api/v1/monitors', 'POST', identity, scope, {type:'bruno', name:'Empty Bruno', active:false}))
    monitorId = created.data.id
    const context = await browser.newContext({viewport:{width:1280,height:900}})
    const cookies = identity.cookie.split('; ').map(part => { const index = part.indexOf('='); return {name:part.slice(0,index),value:part.slice(index+1),url:base} })
    await context.addCookies([...cookies,
      {name:'workspace_id',value:String(scope.workspaceId),url:base},
      {name:'environment_id',value:String(scope.environmentId),url:base},
    ])
    await context.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    const page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/monitors/${monitorId}/edit`)
    await page.getByRole('tab', {name:/Params/}).waitFor()
    assert.equal(await page.getByText('HTTP_BLOCK_REQUIRED').count(), 0, 'empty request must not show a parse error')
    assert.equal(await page.locator('textarea.font-mono').count(), 0, 'UI editor is the default view')
    await page.getByPlaceholder('https://example.com/health', {exact:true}).fill('http://127.0.0.1:1/health')
    await page.getByRole('button', {name:'Raw (.bru)', exact:true}).click()
    assert.match(await page.locator('textarea.font-mono').first().inputValue(), /http:\/\/127.0.0.1:1\/health/)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    if (identity && scope) await cleanup([identity], [scope])
  }
})

test('browser shows preserved script and tests blocks as read-only tabs', {timeout:60000}, async () => {
  let identity: Identity | undefined, scope: Scope | undefined, monitorId: number | undefined
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--disable-dev-shm-usage']})
  try {
    identity = await user('bruno-script-tabs')
    scope = await workspace(identity, 'Bruno script tabs')
    const source = `meta {
  name: Script tabs
  type: http
}

get {
  url: http://127.0.0.1:1/health
  body: none
  auth: none
}

script:pre-request {
  req.setHeader('X-Ignored', '1');
}

tests {
  test('ignored', () => {});
}

settings {
  encodeUrl: false
}
`
    const created = await data(await request('/api/v1/monitors', 'POST', identity, scope, {type:'bruno', name:'Script tabs', active:false, body:source}))
    monitorId = created.data.id
    const context = await browser.newContext({viewport:{width:1280,height:900}})
    const cookies = identity.cookie.split('; ').map(part => { const index = part.indexOf('='); return {name:part.slice(0,index),value:part.slice(index+1),url:base} })
    await context.addCookies([...cookies,
      {name:'workspace_id',value:String(scope.workspaceId),url:base},
      {name:'environment_id',value:String(scope.environmentId),url:base},
    ])
    await context.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    const page = await context.newPage(), errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}/monitors/${monitorId}/edit`)
    await page.getByRole('tab', {name:/Params/}).waitFor()
    await page.getByRole('tab', {name:/Script/}).click()
    assert.match(await page.locator('pre.bruno-response').first().innerText(), /X-Ignored/)
    await page.getByRole('tab', {name:/Tests/}).click()
    assert.match(await page.locator('pre.bruno-response').first().innerText(), /test\('ignored'/)
    await page.getByRole('tab', {name:/Settings/}).click()
    assert.match(await page.locator('pre.bruno-response').first().innerText(), /encodeUrl: false/)
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
    if (identity && scope) await cleanup([identity], [scope])
  }
})

test('browser shows a readable message for an invalid .bru request', {timeout:60000}, async () => {
  let identity: Identity | undefined, scope: Scope | undefined, monitorId: number | undefined
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome', headless:true, args:['--no-sandbox','--disable-dev-shm-usage']})
  try {
    identity = await user('bruno-invalid-ui')
    scope = await workspace(identity, 'Bruno invalid UI')
    const created = await data(await request('/api/v1/monitors', 'POST', identity, scope, {
      type: 'bruno', name: 'Invalid Bruno', active: false, body: 'meta {\n  name: Invalid\n  type: http\n}\n',
    }))
    monitorId = created.data.id
    const context = await browser.newContext({viewport:{width:1280,height:900}})
    const cookies = identity.cookie.split('; ').map(part => { const index = part.indexOf('='); return {name:part.slice(0,index),value:part.slice(index+1),url:base} })
    await context.addCookies([...cookies,
      {name:'workspace_id',value:String(scope.workspaceId),url:base},
      {name:'environment_id',value:String(scope.environmentId),url:base},
    ])
    await context.route('**/*', route => ['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    const page = await context.newPage()
    await page.goto(`${base}/monitors/${monitorId}/edit`)
    await page.getByText(/single GET\/POST/).waitFor()
    assert.equal(await page.getByRole('tab', {name:/Params/}).count(), 0)
  } finally {
    await browser.close()
    if (identity && scope) await cleanup([identity], [scope])
  }
})
