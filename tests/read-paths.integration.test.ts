import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {user,workspace,request,data,cleanup,prisma,connect,type Identity,type Scope} from './helpers/http'
import {monitorDbInput} from '../server/utils/monitor-secrets'
import {rawUptimeWindows} from '../server/services/uptime/queries'
process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
let owner:Identity,other:Identity,scope:Scope,otherScope:Scope,ids:number[],foreign:number,environmentB:number
before(async()=>{
 owner=await user('scale-owner');other=await user('scale-other');scope=await workspace(owner,'Scale 4000');otherScope=await workspace(other,'Other scale')
 environmentB=(await prisma.environment.create({data:{workspaceId:scope.workspaceId,name:'second'}})).id
 const reserved=await prisma.$queryRaw<{id:number}[]>`SELECT nextval(pg_get_serial_sequence('monitors','id'))::int AS id FROM generate_series(1,4001)`;ids=reserved.slice(0,4000).map(row=>row.id);foreign=reserved[4000]!.id
 for(let i=0;i<4000;i+=250)await prisma.monitor.createMany({data:ids.slice(i,i+250).map((id,index)=>monitorDbInput({id,userId:owner.id,...scope,name:`Scale ${String(i+index).padStart(4,'0')}`,type:'http',active:true,interval:60,timeout:1,url:'http://127.0.0.1:9/?token=READ_PATH_PRIVATE',nextCheckAt:new Date(Date.now()+86400000)}))})
 await prisma.monitor.create({data:monitorDbInput({id:foreign,userId:other.id,...otherScope,name:'Foreign',type:'http',active:false,url:'http://127.0.0.1:9'})})
 const now=new Date();await prisma.monitorState.createMany({data:ids.map(monitorId=>({monitorId,...scope,status:1,ping:0,checkCode:'CHECK_OK',checkedAt:now,statusChangedAt:now}))})
})
after(async()=>{await cleanup([owner,other],[scope,otherScope])})
test('4000 monitors paginate exactly once with bound scope/filter cursors and complete summary',{timeout:30000},async()=>{
 const initial=await data(await request('/api/v1/monitors','GET',owner,scope));assert.equal(initial.data.length,100);assert.ok(initial.page.hasMore);assert.ok(initial.data.every((row:any)=>row.heartbeats.length===1));assert.ok(!JSON.stringify(initial).includes('READ_PATH_PRIVATE'))
 const summary=await data(await request('/api/v1/monitors/summary','GET',owner,scope));assert.equal(summary.data.total,4000);assert.equal(summary.data.up,4000)
 const seen:number[]=[];let cursor:string|null=null
 do{const response=await data(await request('/api/v1/monitors?limit=200'+(cursor?'&cursor='+encodeURIComponent(cursor):''),'GET',owner,scope));seen.push(...response.data.map((row:any)=>row.id));cursor=response.page.nextCursor}while(cursor)
 assert.deepEqual(seen,ids)
 const search=await data(await request('/api/v1/monitors?search=Scale%203999','GET',owner,scope));assert.equal(search.data[0].id,ids.at(-1))
 for(const [query,target]of [['?cursor='+encodeURIComponent(initial.page.nextCursor),otherScope],['?search=changed&cursor='+encodeURIComponent(initial.page.nextCursor),scope],['?cursor='+encodeURIComponent(initial.page.nextCursor+'x'),scope]] as const)assert.equal((await request('/api/v1/monitors'+query,'GET',owner,target)).status,target===otherScope?404:400)
 assert.equal((await request('/api/v1/monitors?limit=201','GET',owner,scope)).status,400)
 for(const path of ['lookup','state','recent-heartbeats']){const response=await data(await request(`/api/v1/monitors/${path}?ids=${ids[0]},${ids[201]}`,'GET',owner,scope));assert.ok(response.ok);assert.equal((await request(`/api/v1/monitors/${path}?ids=${ids[0]},${foreign}`,'GET',owner,scope)).status,404)}
})
test('history cursor resolves identical timestamps, ignores later inserts and rejects large offset',async()=>{
 const monitorId=ids[0]!,time=new Date(Date.now()-60000)
 await prisma.heartbeat.createMany({data:Array.from({length:6},()=>({monitorId,time,status:1,ping:0,coverageSeconds:120}))})
 const first=await data(await request(`/api/v1/monitors/${monitorId}/heartbeats?limit=2`,'GET',owner,scope));assert.equal(first.total,undefined)
 await prisma.heartbeat.create({data:{monitorId,time:new Date(),status:0,ping:1,coverageSeconds:120}})
 const seen=first.data.map((row:any)=>row.id);let cursor=first.page.nextCursor
 while(cursor){const page=await data(await request(`/api/v1/monitors/${monitorId}/heartbeats?limit=2&cursor=${encodeURIComponent(cursor)}`,'GET',owner,scope));seen.push(...page.data.map((row:any)=>row.id));cursor=page.page.nextCursor}
 assert.equal(seen.length,6);assert.equal(new Set(seen).size,6)
 assert.equal((await request(`/api/v1/monitors/${monitorId}/heartbeats?offset=1001`,'GET',owner,scope)).status,400)
})
test('SQL uptime follows preceding status, anchor, ties, maintenance and bounded gaps with valid zero-ms pings',async()=>{
 const monitorId=ids[1]!,start=new Date('2026-01-01T00:00:00Z'),at=(seconds:number)=>new Date(start.getTime()+seconds*1000)
 await prisma.heartbeat.createMany({data:[{monitorId,time:at(-20),status:1,ping:0,coverageSeconds:120},{monitorId,time:at(60),status:0,ping:1,coverageSeconds:120},{monitorId,time:at(120),status:1,ping:0,coverageSeconds:120},{monitorId,time:at(180),status:0,ping:1,coverageSeconds:120},{monitorId,time:at(180),status:3,ping:0,coverageSeconds:120}]})
 const result=(await rawUptimeWindows([monitorId],[{key:'range',start,end:at(600)}],prisma)).get(`${monitorId}:range`)!
 assert.equal(result.uptimeMs,120000);assert.equal(result.downtimeMs,60000);assert.equal(result.maintenanceMs,120000);assert.equal(result.unknownMs,300000);assert.equal(result.uptime,66.67);assert.equal(result.avgPing,0);assert.equal(result.pingCount,1)
 const direction=(await rawUptimeWindows([monitorId],[{key:'direction',start,end:at(60)}],prisma)).get(`${monitorId}:direction`)!;assert.equal(direction.uptime,100)
 const absent=(await rawUptimeWindows([ids[2]!],[{key:'none',start,end:at(60)}],prisma)).get(`${ids[2]}:none`)!;assert.equal(absent.uptime,null);assert.equal(absent.avgPing,null)
})
test('bounded page socket snapshots survive missing raw history and reject out-of-scope batches',{timeout:10000},async()=>{
 const socket=await connect(owner,scope),received:any[]=[];socket.on('heartbeat',event=>received.push(event))
 const subscribe=(input:any)=>new Promise<any>(resolve=>socket.emit('subscribe_monitors',input,resolve))
 try{
  assert.equal((await subscribe(ids.slice(0,201))).ok,false);assert.equal((await subscribe([ids[0],foreign])).ok,false)
  assert.equal((await subscribe([ids[5]])).ok,true)
  const end=Date.now()+3000;while(!received.length&&Date.now()<end)await new Promise(r=>setTimeout(r,20))
  assert.equal(received[0].monitorId,ids[5]);assert.equal(received[0].heartbeat.status,1)
  assert.equal((await subscribe([])).count,0)
 }finally{socket.disconnect()}
})
test('concurrent single subscriptions keep the 200-ID cap and queued page replacement ends on the latest page',{timeout:10000},async()=>{
 const socket=await connect(owner,scope),events:any[]=[];socket.on('heartbeat',event=>events.push(event))
 const emit=(event:string,input:any)=>new Promise<any>(resolve=>socket.emit(event,input,resolve))
 try{
  assert.equal((await emit('subscribe_monitors',ids.slice(0,195))).count,195)
  await new Promise(r=>setTimeout(r,1100))
  const results=await Promise.all(ids.slice(195,215).map(id=>emit('subscribe_monitor',id)))
  assert.equal(results.filter(result=>result.ok).length,5)
  await new Promise(r=>setTimeout(r,1100))
  await Promise.all([emit('subscribe_monitors',[ids[300]]),emit('subscribe_monitors',[ids[301]])]);events.length=0
  await prisma.monitorState.update({where:{monitorId:ids[300]},data:{revision:{increment:1}}});await prisma.monitorState.update({where:{monitorId:ids[301]},data:{revision:{increment:1}}})
  const end=Date.now()+3000;while(!events.length&&Date.now()<end)await new Promise(r=>setTimeout(r,20))
  assert.ok(events.length>0);assert.ok(events.every(event=>event.monitorId===ids[301]))
 }finally{socket.disconnect()}
})

test('private status configuration enforces roles and preserves complete cross-environment selections',async()=>{
 await data(await request(`/api/v1/workspaces/${scope.workspaceId}/members`,'POST',owner,scope,{username:other.username,role:'viewer'}))
 const cross=(await prisma.monitor.create({data:monitorDbInput({userId:owner.id,workspaceId:scope.workspaceId,environmentId:environmentB,name:'Cross environment',type:'http',active:false,url:'http://127.0.0.1:9/?token=CONFIG_SECRET'})})).id
 const selected=[...ids.slice(0,300),cross],page=await prisma.statusPage.create({data:{userId:owner.id,workspaceId:scope.workspaceId,slug:'private-config-'+Date.now(),title:'Private config',groups:{create:{name:'All environments',monitors:{create:selected.map(monitorId=>({monitorId}))}}}}}),path=`/api/v1/status-pages/${page.slug}/config`
 assert.equal((await request(path)).status,401);assert.equal((await request(path,'GET',other,scope)).status,403);assert.equal((await request(path,'GET',other,otherScope)).status,404)
 const response=await data(await request(path,'GET',owner,scope));const config=response.data;assert.ok(!JSON.stringify(config).includes('CONFIG_SECRET'));assert.deepEqual(config.publicGroupList.flatMap((g:any)=>g.monitorList.map((m:any)=>m.id)).sort((a:number,b:number)=>a-b),selected.sort((a,b)=>a-b))
 await data(await request(`/api/v1/status-pages/${page.slug}`,'PUT',owner,scope,{title:'Rename only',publicGroupList:config.publicGroupList}));assert.deepEqual((await prisma.statusPageMonitor.findMany({where:{group:{statusPageId:page.id}}})).map(row=>row.monitorId).sort((a,b)=>a-b),selected)
})
