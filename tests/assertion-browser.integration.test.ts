import {test} from 'node:test'
import {createMonitorSchema} from '../server/utils/monitor-input'
import assert from 'node:assert/strict'
import http from 'node:http'
import {chromium} from 'playwright'
import {base,user,workspace,cleanup,prisma,request,type Identity,type Scope} from './helpers/http'
test('browser creates typed assertions, tests pass/fail, reloads masked config and preserves URL when renaming',{timeout:60000},async()=>{
  let identity:Identity|undefined,scope:Scope|undefined,success=true,monitorId:number|undefined
  const fixture=http.createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({success}))})
  await new Promise<void>(r=>fixture.listen(0,'127.0.0.1',r))
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
  try{
    identity=await user('assertion-browser');scope=await workspace(identity,'Browser workspace')
    const context=await browser.newContext({viewport:{width:1280,height:900}})
    const cookies=identity.cookie.split('; ').map(part=>{const separator=part.indexOf('=');return{name:part.slice(0,separator),value:part.slice(separator+1),url:base}})
    await context.addCookies([...cookies,{name:'workspace_id',value:String(scope.workspaceId),url:base},{name:'environment_id',value:String(scope.environmentId),url:base}])
    await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
    const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    page.on('request',req=>{if(req.url().endsWith('/test')){const parsed=createMonitorSchema.safeParse(req.postDataJSON());if(!parsed.success)console.info('INVALID_FIELDS',parsed.error.issues)}})
    page.on('response',async response=>{if(response.url().endsWith('/test'))console.info('TRIAL',response.status(),await response.text())})
    await page.goto(base+'/monitors/add')
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()==='Create Monitor'&&!button.disabled))
    await page.getByPlaceholder('My Monitor',{exact:true}).fill('Browser assertion monitor')
    await page.getByPlaceholder('https://example.com',{exact:true}).fill(`http://127.0.0.1:${(fixture.address() as any).port}/`)
    await page.getByRole('button',{name:'Add assertion',exact:false}).click()
    await page.getByRole('button',{name:'Test request and assertions',exact:true}).click()
    await page.getByText('Assertions: Passed',{exact:true}).waitFor({timeout:5000}).catch(async error=>{console.info((await page.locator('form').innerText()).slice(-4000));throw error})
    success=false
    await page.getByRole('button',{name:'Test request and assertions',exact:true}).click()
    await page.getByText('Assertions: Failed',{exact:true}).waitFor()
    const expected=page.getByLabel('Expected JSON value')
    await expected.fill('invalid JSON')
    assert.equal(await page.getByRole('button',{name:'Create Monitor',exact:true}).isDisabled(),true)
    await expected.fill('true');success=true
    await page.getByRole('button',{name:'Create Monitor',exact:true}).click()
    await page.waitForURL(/\/monitors\/\d+$/)
    monitorId=Number(new URL(page.url()).pathname.split('/').at(-1))
    await page.goto(base+`/monitors/${monitorId}/edit`)
    await page.getByPlaceholder('My Monitor',{exact:true}).waitFor()
    assert.equal(await page.getByPlaceholder('https://example.com',{exact:true}).inputValue(),'')
    await page.getByText('Clear configured url',{exact:false}).waitFor()
    await page.getByPlaceholder('My Monitor',{exact:true}).fill('Browser renamed')
    await page.getByRole('button',{name:'Test request and assertions',exact:true}).click()
    await page.getByText('Assertions: Passed',{exact:true}).waitFor()
    await page.screenshot({path:'/tmp/uptime-phase2-assertion-browser.png',fullPage:true})
    await page.getByRole('button',{name:'Save Monitor',exact:true}).click()
    await page.waitForURL(/\/monitors$/)
    const record=await prisma.monitor.findUniqueOrThrow({where:{id:monitorId}})
    assert.equal(record.name,'Browser renamed');assert.ok(record.requestSecrets);assert.equal(record.url,null)
    assert.deepEqual(errors,[])
  }finally{
    await browser.close();fixture.closeAllConnections();await new Promise<void>(r=>fixture.close(()=>r()))
    if(identity&&scope){if(monitorId)await request(`/api/v1/monitors/${monitorId}/pause`,'POST',identity,scope);await cleanup([identity],[scope])}
  }
})
