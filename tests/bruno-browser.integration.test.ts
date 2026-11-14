import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import path from 'node:path'
import {chromium} from 'playwright'
import {base,user,workspace,cleanup,prisma,type Identity,type Scope} from './helpers/http'
test('browser previews a collection, imports paused and tests the same typed assertions',{timeout:60000},async()=>{
  let identity:Identity|undefined,scope:Scope|undefined,hits=0
  const fixture=http.createServer(async(req,res)=>{hits++;let body='';for await(const chunk of req)body+=chunk;const url=new URL(req.url!,'http://localhost');res.setHeader('content-type','application/json');res.setHeader('x-fixture','ready');res.end(JSON.stringify({success:url.searchParams.get('token')==='browser-token'&&JSON.parse(body).scope==='request'}))})
  await new Promise<void>(r=>fixture.listen(0,'127.0.0.1',r))
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
  try{
    identity=await user('bruno-browser');scope=await workspace(identity,'Browser Bruno')
    const context=await browser.newContext({viewport:{width:1280,height:900}})
    const cookies=identity.cookie.split('; ').map(part=>{const index=part.indexOf('=');return{name:part.slice(0,index),value:part.slice(index+1),url:base}})
    await context.addCookies([...cookies,{name:'workspace_id',value:String(scope.workspaceId),url:base},{name:'environment_id',value:String(scope.environmentId),url:base}])
    await context.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
    const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    await page.goto(base+'/settings/bruno')
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(input=>input.type==='file'&&!input.disabled))
    await page.getByLabel('Collection identity',{exact:true}).fill('browser-bruno')
    await page.getByLabel('Collection directory',{exact:true}).setInputFiles(path.resolve('tests/fixtures/bruno/nested'))
    await page.getByLabel('Source environment',{exact:true}).selectOption('environments/local.bru')
    await page.getByLabel('Static variable overrides (JSON object)',{exact:true}).fill(JSON.stringify({origin:`http://127.0.0.1:${(fixture.address() as any).port}`}))
    await page.getByLabel('Secret values (JSON object, write-only)',{exact:true}).fill(JSON.stringify({token:'browser-token'}))
    await page.getByRole('button',{name:'Preview import',exact:true}).click()
    await page.getByText('1 requests · 1 create · 0 replace · 0 skip',{exact:true}).waitFor()
    assert.equal(hits,0);assert.equal(await prisma.monitor.count({where:{workspaceId:scope.workspaceId}}),0)
    await page.getByLabel('Secret values (JSON object, write-only)',{exact:true}).evaluate(element=>element.style.color='transparent')
    await page.screenshot({path:'/tmp/uptime-phase3-bruno-preview.png',fullPage:true,mask:[page.getByLabel('Secret values (JSON object, write-only)',{exact:true})]})
    await page.getByLabel('Secret values (JSON object, write-only)',{exact:true}).evaluate(element=>element.style.color='')
    await page.getByRole('button',{name:'Import paused monitors',exact:true}).click()
    await page.getByText('Import complete — monitors paused',{exact:true}).waitFor()
    assert.equal(hits,0)
    const monitor=await prisma.monitor.findFirstOrThrow({where:{workspaceId:scope.workspaceId}});assert.equal(monitor.active,false)
    assert.equal(await page.getByLabel('Secret values (JSON object, write-only)',{exact:true}).inputValue(),'')
    await page.goto(base+`/monitors/${monitor.id}/edit`)
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()==='Save Monitor'&&!button.disabled))
    await page.getByRole('button',{name:'Test request and assertions',exact:true}).click()
    await page.getByText('Assertions: Passed',{exact:true}).waitFor()
    assert.equal(hits,1);assert.deepEqual(errors,[])
  }finally{await browser.close();fixture.closeAllConnections();await new Promise<void>(r=>fixture.close(()=>r()));if(identity&&scope)await cleanup([identity],[scope])}
})
