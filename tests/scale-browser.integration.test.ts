import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {user,workspace,cleanup,prisma,base,type Identity,type Scope} from './helpers/http'
import {monitorDbInput} from '../server/utils/monitor-secrets'
import {mkdirSync} from 'node:fs'
process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
test('desktop/mobile bounded monitor pages search beyond 201 and picker preserves 300 existing selections',{timeout:60000},async()=>{
 let owner:Identity|undefined,scope:Scope|undefined;const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']})
 try{
  owner=await user('scale-browser');scope=await workspace(owner,'Browser scale')
  const rows=await prisma.$queryRaw<{id:number}[]>`SELECT nextval(pg_get_serial_sequence('monitors','id'))::int AS id FROM generate_series(1,350)`,ids=rows.map(row=>row.id)
  await prisma.monitor.createMany({data:ids.map((id,index)=>monitorDbInput({id,...scope!,userId:owner!.id,name:`Browser ${String(index).padStart(4,'0')}`,active:false,type:'http',url:'http://127.0.0.1:9/?token=BROWSER_SCALE_SECRET'}))})
  const pageRecord=await prisma.statusPage.create({data:{userId:owner.id,workspaceId:scope.workspaceId,slug:'browser-scale-'+Date.now(),title:'Large status selection',groups:{create:{name:'Main',monitors:{create:ids.slice(0,300).map(monitorId=>({monitorId}))}}}}})
  const context=await browser.newContext({viewport:{width:1280,height:900}})
  await context.addCookies([...owner.cookie.split('; ').map(part=>{const i=part.indexOf('=');return {name:part.slice(0,i),value:part.slice(i+1),url:base}}),{name:'workspace_id',value:String(scope.workspaceId),url:base},{name:'environment_id',value:String(scope.environmentId),url:base}])
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/dashboard');await page.getByRole('heading',{name:'Monitor overview'}).waitFor({timeout:10000}).catch(async error=>{console.info('Scale browser initial page',page.url(),(await page.locator('body').innerText()).slice(0,1600),'errors',errors);await page.screenshot({path:'.data/validation-logs/scale-browser-failure.png',fullPage:true});throw error})
  await page.getByText('Live',{exact:true}).waitFor();await page.getByRole('link',{name:'Browser 0000',exact:false}).first().waitFor();assert.ok(await page.locator('a[href^="/monitors/"]').count()<=102)
  await page.getByRole('button',{name:'Next page',exact:true}).click();await page.getByRole('link',{name:'Browser 0100',exact:false}).first().waitFor()
  await page.getByRole('textbox',{name:'Search monitors'}).fill('Browser 0349');await page.getByRole('link',{name:'Browser 0349',exact:false}).first().waitFor()
  mkdirSync('.data/validation-logs',{recursive:true});await page.screenshot({path:'.data/validation-logs/scale-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth), 'mobile page must not overflow its viewport')
  await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('link',{name:'Monitors',exact:true}).click();await page.getByRole('textbox',{name:'Search monitors'}).waitFor();await page.screenshot({path:'.data/validation-logs/scale-mobile.png',fullPage:true})
  // Canonical status editor must preserve the complete selected set while searching remote options.
  await page.setViewportSize({width:1280,height:900});await page.goto(base+`/status-pages/${pageRecord.slug}/edit`)
  await page.getByText('300 selected',{exact:true}).waitFor();await page.getByPlaceholder('Search monitors...').fill('Browser 0349');await page.locator('.dropdown-item').filter({hasText:'Browser 0349'}).click();await page.getByRole('button',{name:'Update Status Page',exact:true}).click();await page.waitForURL(base+'/status-pages');await page.getByText('Large status selection',{exact:true}).waitFor();const listResponse=await context.request.get(base+'/api/v1/status-pages');assert.equal(listResponse.status(),200);assert.deepEqual((await prisma.statusPageMonitor.findMany({where:{group:{statusPageId:pageRecord.id}},select:{monitorId:true}})).map(row=>row.monitorId).sort((a,b)=>a-b),[...ids.slice(0,300),ids[349]!].sort((a,b)=>a-b))
  assert.ok(!await page.content().then(html=>html.includes('BROWSER_SCALE_SECRET')))
  assert.deepEqual(errors,[])
 }finally{await browser.close();if(owner&&scope)await cleanup([owner],[scope])}
})
