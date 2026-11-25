import {test} from 'node:test'
import assert from 'node:assert/strict'
import {user,workspace,request,data,cleanup,prisma,base,type Identity,type Scope} from './helpers/http'

test('tag partial updates enforce workspace roles and key permissions without changing omitted fields',async()=>{
 const identities:Identity[]=[],scopes:Scope[]=[]
 try{
  const owner=await user('tag-owner'),editor=await user('tag-editor'),viewer=await user('tag-viewer');identities.push(owner,editor,viewer)
  const a=await workspace(owner,'Tag target'),b=await workspace(owner,'Tag foreign');scopes.push(a,b)
  for(const [member,role]of [[editor,'editor'],[viewer,'viewer']] as const)await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`,'POST',owner,a,{username:member.username,role}))
  const tag=(await data(await request('/api/v1/tags','POST',owner,a,{name:'Original',color:'#12abEF'}))).data
  const foreign=(await data(await request('/api/v1/tags','POST',owner,b,{name:'Foreign',color:'#123456'}))).data
  const path=`/api/v1/tags/${tag.id}`
  await data(await request(path,'PUT',editor,a,{name:'  Renamed  '}));assert.equal((await prisma.tag.findUniqueOrThrow({where:{id:tag.id}})).color,'#12abEF')
  await data(await request(path,'PUT',owner,a,{color:'#ABCDEF'}));assert.equal((await prisma.tag.findUniqueOrThrow({where:{id:tag.id}})).name,'Renamed')
  assert.equal((await request(path,'PUT',viewer,a,{name:'Denied'})).status,403);assert.equal((await request(path,'PUT',undefined,undefined,{name:'Denied'})).status,401)
  for(const scope of ['read','write']){
   const key=await data(await request('/api/v1/api-keys','POST',owner,a,{name:'Tag '+scope,scope}));assert.equal((await request(path,'PUT',undefined,a,{name:'Key edit'},{'x-api-key':key.key})).status,scope==='read'?403:200)
  }
  for(const body of [{},{name:''},{name:'   '},{name:'x'.repeat(101)},{color:'red'},{color:'#fff'},{name:'Bad',workspaceId:b.workspaceId},{userId:owner.id}])assert.equal((await request(path,'PUT',owner,a,body)).status,400)
  for(const id of ['0','1tail','9007199254740992'])assert.equal((await request(`/api/v1/tags/${id}`,'PUT',owner,a,{name:'Bad'})).status,400)
  assert.equal((await request(`/api/v1/tags/${foreign.id}`,'PUT',owner,a,{name:'Foreign edit'})).status,404)
  const stored=await prisma.tag.findUniqueOrThrow({where:{id:tag.id}});assert.equal(stored.name,'Key edit');assert.equal(stored.color,'#ABCDEF');assert.equal((await prisma.tag.findUniqueOrThrow({where:{id:foreign.id}})).name,'Foreign')
  const reloaded=await data(await request('/api/v1/tags','GET',owner,a));assert.equal(reloaded.data.find((row:{id:number})=>row.id===tag.id).name,'Key edit')
 }finally{if(identities.length)await cleanup(identities,scopes)}
})

test('legacy node timestamps preserve persisted lastSeen and expose missing observations as null',async()=>{
 const identities:Identity[]=[],scopes:Scope[]=[],ids:number[]=[]
 try{
  const owner=await user('legacy-time');identities.push(owner);const scope=await workspace(owner,'Legacy time');scopes.push(scope);await prisma.user.update({where:{id:owner.id},data:{platformAdmin:true}})
  const seen=new Date('2001-02-03T04:05:06.000Z')
  for(const lastSeen of [seen,null]){const row=await prisma.node.create({data:{nodeId:'owned-'+Date.now()+'-'+ids.length,nodeName:'Timestamp fixture',status:'online',lastSeen}});ids.push(row.id)}
  const response=await data(await request('/api/cluster/nodes','GET',owner,scope));const rows=await prisma.node.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}})
  assert.equal(response.find((row:{id:string})=>row.id===rows[0]!.nodeId).lastCheck,seen.getTime());assert.equal(response.find((row:{id:string})=>row.id===rows[1]!.nodeId).lastCheck,null)
 }finally{await prisma.node.deleteMany({where:{id:{in:ids}}});if(identities.length)await cleanup(identities,scopes)}
})

test('tag edit reload and public status group drag save preserve actual values and monitor links',{timeout:30000},async(t)=>{
 const {mkdir,chmod}=await import('node:fs/promises');await mkdir('.data/validation-logs',{recursive:true});const artifact='.data/validation-logs/slice1-browser-'+Date.now()
 let checkpoint='launch',page:import('playwright').Page|undefined,context:import('playwright').BrowserContext|undefined
 const step=async(name:string,action:()=>Promise<void>)=>{checkpoint=name;t.diagnostic('START '+name);const started=Date.now();await action();t.diagnostic('PASS '+name+' '+(Date.now()-started)+'ms')}
 const {chromium}=await import('playwright'),browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});let owner:Identity|undefined,scope:Scope|undefined
 try{
  owner=await user('slice-browser');scope=await workspace(owner,'Slice browser')
  const tag=(await data(await request('/api/v1/tags','POST',owner,scope,{name:'Browser tag before',color:'#123456'}))).data
  const monitorIds:number[]=[];for(const name of ['First monitor','Second monitor'])monitorIds.push((await data(await request('/api/v1/monitors','POST',owner,scope,{name,type:'http',url:'http://127.0.0.1:9',active:false}))).data.id)
  const slug='slice-groups-'+Date.now(),record=(await data(await request('/api/v1/status-pages','POST',owner,scope,{slug,title:'Group drag fixture',published:true}))).data
  await data(await request(`/api/v1/status-pages/${slug}`,'PUT',owner,scope,{publicGroupList:monitorIds.map((id,index)=>({id:-(index+1),name:index?'Second group':'First group',weight:index+1,monitorList:[{id}]}))}))
  const original=await prisma.statusPageGroup.findMany({where:{statusPageId:record.id},orderBy:{weight:'asc'},include:{monitors:true}})
  context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(4500);context.setDefaultNavigationTimeout(7000);await context.tracing.start({screenshots:true,snapshots:true,sources:false})
  await context.addCookies([...owner.cookie.split('; ').map(part=>{const i=part.indexOf('=');return{name:part.slice(0,i),value:part.slice(i+1),url:base}}),{name:'workspace_id',value:String(scope.workspaceId),url:base},{name:'environment_id',value:String(scope.environmentId),url:base}])
  await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
  page=await context.newPage();const p=page,errors:string[]=[];p.on('pageerror',error=>errors.push(error.message))
  await step('tags page loaded',async()=>{await p.goto(base+'/settings/tags');await p.getByRole('button',{name:'Edit',exact:true}).waitFor()})
  await step('tag edit dialog',async()=>{await p.getByRole('button',{name:'Edit',exact:true}).click();await p.getByPlaceholder('Tag name').fill('Browser tag after')})
  await step('tag update persisted',async()=>{const response=p.waitForResponse(r=>r.url().endsWith('/api/v1/tags/'+tag.id)&&r.request().method()==='PUT');await p.getByRole('button',{name:'Update',exact:true}).click();assert.equal((await response).status(),200);await p.getByText('Browser tag after',{exact:true}).waitFor()})
  await step('tag reload',async()=>{await p.reload();await p.getByText('Browser tag after',{exact:true}).waitFor();assert.equal((await prisma.tag.findUniqueOrThrow({where:{id:tag.id}})).name,'Browser tag after')})
  await step('status page loaded',async()=>{await p.goto(base+'/status/'+slug);await p.getByRole('button',{name:/Edit Mode/}).waitFor()})
  await step('status edit mode',async()=>{await p.getByRole('button',{name:/Edit Mode/}).click();await p.locator('.public-group-list .group-name-input').nth(1).waitFor();await p.getByRole('button',{name:/Hide Sidebar/}).click()})
  await step('group drag reorder',async()=>{
   const dragEvents:{type:string;order:string[]}[]=[]
   await p.exposeFunction('recordGroupDrag',(event:{type:string;order:string[]})=>{if(dragEvents.length<60||event.type==='dragend'||event.type==='drop')dragEvents.push(event)})
   await p.evaluate(()=>{for(const type of ['dragstart','dragenter','dragover','drop','dragend'])document.addEventListener(type,event=>{if(!(event.target instanceof Element)||!event.target.closest('.public-group-list'))return;void(window as unknown as {recordGroupDrag:(event:{type:string;order:string[]})=>Promise<void>}).recordGroupDrag({type:event.type,order:[...document.querySelectorAll<HTMLInputElement>('.public-group-list .group-name-input')].map(input=>input.value)})},true)})
   // Native HTML5 drag can miss a pointer under parallel load; retry with fresh boxes up to 3 times.
   let reordered=false
   for(let attempt=1;attempt<=3&&!reordered;attempt++){
    const source=p.locator('.public-group-list .group-drag-handle').nth(1),target=p.locator('.public-group-list .group-title').first()
    await source.scrollIntoViewIfNeeded();const from=await source.boundingBox(),to=await target.boundingBox();assert.ok(from);assert.ok(to)
    try{await p.mouse.move(from.x+from.width/2,from.y+from.height/2);await p.mouse.down();await p.waitForTimeout(120);await p.mouse.move(from.x+from.width/2,from.y+from.height/2-8,{steps:6});await p.waitForTimeout(120);await p.mouse.move(to.x+12,to.y+4,{steps:30});await p.mouse.move(to.x+13,to.y+5,{steps:3});await p.waitForTimeout(200);await p.mouse.move(to.x+12,to.y+4,{steps:3});await p.waitForTimeout(200)}finally{await p.mouse.up()}
    reordered=await p.waitForFunction(()=>document.querySelector<HTMLInputElement>('.public-group-list .group-name-input')?.value==='Second group',undefined,{timeout:2500}).then(()=>true).catch(()=>false)
    t.diagnostic('Group drag attempt '+attempt+' reordered='+reordered)
   }
   assert.ok(reordered,'Group drag reorder did not complete')
   assert.ok(dragEvents.some(event=>event.type==='dragstart'),'Native group dragstart observed')
   assert.ok(dragEvents.some(event=>event.type==='dragend'),'Native group dragend observed')
   t.diagnostic('Native drag evidence '+JSON.stringify(dragEvents))
  })
  await step('status save',async()=>{await p.getByRole('button',{name:/Show Sidebar/}).click();const response=p.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1/status-pages/'+slug&&r.request().method()==='PUT');await p.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await response).status(),200);await p.getByRole('button',{name:/Edit Mode/}).waitFor()})
  await step('stored group identity and links',async()=>{const saved=await prisma.statusPageGroup.findMany({where:{statusPageId:record.id},orderBy:{weight:'asc'},include:{monitors:true}});assert.deepEqual(saved.map(row=>row.id),original.map(row=>row.id).reverse());assert.deepEqual(saved.flatMap(row=>row.monitors.map(link=>link.monitorId)).sort((a,b)=>a-b),monitorIds.sort((a,b)=>a-b))})
  await step('status reload retains order',async()=>{await p.reload();await p.getByRole('button',{name:/Edit Mode/}).click();await p.locator('.public-group-list .group-name-input').nth(1).waitFor();assert.deepEqual(await p.locator('.public-group-list .group-name-input').evaluateAll(elements=>elements.map(element=>(element as HTMLInputElement).value)),['Second group','First group']);assert.deepEqual(errors,[])})
  await context.tracing.stop()
 }catch(error){
  t.diagnostic('FAILED checkpoint='+checkpoint)
  if(page){t.diagnostic(JSON.stringify(await page.evaluate(()=>({path:location.pathname,title:document.title,buttons:[...document.querySelectorAll('button')].map(e=>e.textContent?.trim()).filter(Boolean),groups:[...document.querySelectorAll<HTMLInputElement>('.public-group-list .group-name-input')].map(e=>e.value)})).catch(()=>({unavailable:true}))));await page.screenshot({path:artifact+'.png',fullPage:true,timeout:3000}).catch(()=>{});await chmod(artifact+'.png',0o600).catch(()=>{})}
  if(context){await context.tracing.stop({path:artifact+'.zip'}).then(()=>chmod(artifact+'.zip',0o600)).catch(()=>{});t.diagnostic('Private fixture-only failure artifacts: '+artifact+'.{png,zip}; trace may contain disposable session cookies')}
  throw new Error('Browser checkpoint failed: '+checkpoint,{cause:error})
 }finally{await browser.close();if(owner&&scope)await cleanup([owner],[scope])}
})
