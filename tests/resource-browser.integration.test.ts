import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {chromium,type BrowserContext} from 'playwright'
import {base,user,workspace,cleanup,prisma,request,data,type Identity,type Scope} from './helpers/http'
import {hydrateResource} from '../server/utils/resource-secrets'
process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
test('resource UI preserves write-only notification and browser settings, tests by ID and hides viewer mutations',{timeout:60000},async()=>{
  let owner:Identity|undefined,viewer:Identity|undefined,scope:Scope|undefined,hits=0
  const fixture=http.createServer(async(req,res)=>{hits++;for await(const _ of req){};res.setHeader('content-type','application/json');res.end(JSON.stringify({Browser:'Chrome',webSocketDebuggerUrl:'ws://private/UI_SECRET'}))})
  await new Promise<void>(r=>fixture.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${(fixture.address() as any).port}`
  const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
  async function context(identity:Identity){
    const context=await browser.newContext({viewport:{width:1280,height:900}})
    await context.addCookies([...identity.cookie.split('; ').map(part=>{const i=part.indexOf('=');return{name:part.slice(0,i),value:part.slice(i+1),url:base}}),{name:'workspace_id',value:String(scope!.workspaceId),url:base},{name:'environment_id',value:String(scope!.environmentId),url:base}])
    await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
    return context
  }
  try{
    owner=await user('resource-ui-owner');viewer=await user('resource-ui-viewer');scope=await workspace(owner,'Resource UI')
    await data(await request(`/api/v1/workspaces/${scope.workspaceId}/members`,'POST',owner,scope,{username:viewer.username,role:'viewer'}))
    const ctx=await context(owner),page=await ctx.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
    for(const [path,kind,name,urlField]of [['notifications','notification','Browser webhook','Webhook URL'],['remote-browsers','remoteBrowser','Browser endpoint','url']] as const){
      await page.goto(base+'/settings/'+path);await page.getByRole('button',{name:'Add resource',exact:true}).waitFor();await page.getByRole('button',{name:'Add resource',exact:true}).click()
      await page.getByLabel('Name',{exact:true}).fill(name)
      await page.getByLabel(urlField,{exact:true}).fill(origin+'/?token=UI_SECRET')
      await page.getByRole('button',{name:'Save resource',exact:true}).click();await page.getByRole('cell',{name,exact:true}).waitFor()
      await page.getByRole('button',{name:'Edit',exact:true}).click()
      if(kind==='notification'){assert.equal(await page.getByLabel('Replace stored configuration',{exact:true}).isChecked(),false);assert.equal(await page.getByLabel('Webhook URL',{exact:true}).count(),0)}
      else assert.equal(await page.getByLabel('url',{exact:true}).inputValue(),'')
      await page.getByLabel('Name',{exact:true}).fill(name+' renamed');await page.getByRole('button',{name:'Save resource',exact:true}).click();await page.getByRole('cell',{name:name+' renamed',exact:true}).waitFor()
      await page.reload();await page.getByRole('button',{name:'Test',exact:true}).waitFor();const before=hits
      await page.getByRole('button',{name:'Test',exact:true}).click();await page.getByRole('status').filter({hasText:'CONNECTION_OK'}).waitFor();assert.equal(hits,before+1)
      const stored=await (prisma as any)[kind].findFirst({where:{workspaceId:scope.workspaceId}}),hydrated=hydrateResource(kind,stored)
      assert.ok(JSON.stringify(hydrated).includes('UI_SECRET'));assert.ok(!JSON.stringify(stored).includes('UI_SECRET'));assert.ok(!(await page.locator('body').textContent())?.includes('UI_SECRET'))
      await page.getByRole('button',{name:'Edit',exact:true}).click()
      if(kind==='notification')await page.getByLabel('Replace stored configuration',{exact:true}).check()
      await page.getByLabel(urlField,{exact:true}).fill(origin+'/?token=REPLACED_UI_SECRET')
      await page.getByRole('button',{name:'Save resource',exact:true}).click();await page.getByRole('button',{name:'Save resource',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'Edit',exact:true}).click()
      await page.getByLabel(kind==='notification'?'Clear config':'Clear url',{exact:true}).check()
      await page.getByRole('button',{name:'Save resource',exact:true}).click();await page.getByRole('button',{name:'Save resource',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'Edit',exact:true}).waitFor()
      const cleared=hydrateResource(kind,await (prisma as any)[kind].findUnique({where:{id:stored.id}}))
      assert.deepEqual(kind==='notification'?cleared.config:cleared.url,kind==='notification'?{}:'')
    }
    const viewerContext=await context(viewer),viewerPage=await viewerContext.newPage()
    for(const path of ['notifications','proxies','docker-hosts','remote-browsers']){
      await viewerPage.goto(base+'/settings/'+path);await viewerPage.getByRole('columnheader',{name:'Configuration',exact:true}).waitFor()
      assert.equal(await viewerPage.getByRole('button',{name:/^(Add resource|Edit|Test|Delete)$/}).count(),0)
      assert.ok(!(await viewerPage.locator('body').textContent())?.includes('UI_SECRET'))
    }
    assert.deepEqual(errors,[])
    await page.screenshot({path:'/tmp/uptime-resource-browser.png',fullPage:true})
  }finally{await browser.close();fixture.closeAllConnections();await new Promise<void>(r=>fixture.close(()=>r()));if(owner&&viewer&&scope)await cleanup([owner,viewer],[scope])}
})
