import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {user,workspace,request,data,cleanup,prisma,type Identity,type Scope} from './helpers/http'
let owner:Identity,viewer:Identity,a:Scope,b:Scope,qa:Scope,monitorId:number,crossId:number,foreignId:number,server:http.Server,origin:string,hits=0
before(async()=>{
 owner=await user('rest-owner');viewer=await user('rest-viewer');a=await workspace(owner,'REST A');b=await workspace(owner,'REST B');qa={workspaceId:a.workspaceId,environmentId:(await prisma.environment.create({data:{workspaceId:a.workspaceId,name:'qa'}})).id}
 await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`,'POST',owner,a,{username:viewer.username,role:'viewer'}))
 server=http.createServer((req,res)=>{hits++;res.setHeader('content-type','application/json');res.end('{"ready":true}')});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`
 for(const scope of [a,qa,b]){const response=await data(await request('/api/v1/monitors','POST',owner,scope,{name:'REST fixture',type:'http',url:origin,headers:{'x-test':'nonempty'},active:false,interval:60,timeout:1}));if(scope===a)monitorId=response.data.id;else if(scope===qa)crossId=response.data.id;else foreignId=response.data.id}
})
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await cleanup([owner,viewer],[a,b])})
test('monitor and maintenance REST lifecycles enforce read/write keys, viewer and workspace/environment relations',async()=>{
 const key=async(scope:string,environmentId?:number)=>data(await request('/api/v1/api-keys','POST',owner,a,{name:'REST '+scope,scope,environmentId})),read=await key('read'),write=await key('write'),env=await key('write',a.environmentId)
 const keyed=(path:string,method='GET',body?:any,k=write)=>request(path,method,undefined,a,body,{'x-api-key':k.key})
 assert.equal((await keyed('/api/v1/monitors','POST',{name:'denied',type:'http'},read)).status,403)
 const native=await data(await keyed('/api/v1/monitors','POST',{name:'Key monitor',type:'http',url:origin,active:false,headers:{'x-auth':'secret'},assertions:{version:1,mode:'all',rules:[{id:'ok',source:'status',operator:'equals',expected:200}]}}));const id=native.data.id
 for(const operation of ['resume','pause'])assert.equal((await keyed(`/api/v1/monitors/${id}/${operation}`,'POST')).status,200)
 await data(await keyed(`/api/v1/monitors/${id}`,'PUT',{name:'Key renamed'}));await data(await keyed(`/api/v1/monitors/${id}`,'DELETE'))
 const created=await data(await keyed('/api/v1/maintenances','POST',{title:'Planned',strategy:'manual',monitorIds:[monitorId,crossId]})),endpoint='/api/v1/maintenances/'+created.data.id
 assert.equal(created.data.status,'under-maintenance');assert.equal(created.data.monitors.length,2);assert.ok(Array.isArray(created.data.timeRange));assert.ok(Array.isArray(created.data.weekdays))
 assert.equal((await request(endpoint,'PUT',viewer,a,{title:'forbidden'})).status,403);assert.equal((await keyed(endpoint,'PUT',{title:'forbidden'},read)).status,403)
 assert.equal((await request(endpoint,'GET',owner,b)).status,404);assert.equal((await keyed(endpoint,'GET',undefined,env)).status,404);assert.equal((await keyed(endpoint,'PUT',{monitorIds:[monitorId]},env)).status,404)
 const before=await prisma.maintenanceMonitor.count({where:{maintenanceId:created.data.id}});assert.equal((await keyed(endpoint,'PUT',{monitorIds:[monitorId,foreignId]})).status,404);assert.equal(await prisma.maintenanceMonitor.count({where:{maintenanceId:created.data.id}}),before)
 await data(await keyed(endpoint,'PUT',{title:'Renamed only'}));assert.equal(await prisma.maintenanceMonitor.count({where:{maintenanceId:created.data.id}}),2)
 for(const op of ['pause','resume'])assert.equal((await keyed(endpoint+'/'+op,'POST')).status,200)
 for(const payload of [{title:'Missing dates',strategy:'single'},{title:'Bad timezone',timezone:'invalid'},{title:'Bad cron',strategy:'cron',cron:'invalid'},{title:'Unknown body',monitors:[monitorId]}])assert.equal((await keyed('/api/v1/maintenances','POST',payload)).status,400)
 const own=await data(await keyed('/api/v1/maintenances','POST',{title:'Env only',monitorIds:[monitorId]},env));assert.equal((await keyed('/api/v1/maintenances/'+own.data.id,'GET',undefined,env)).status,200)
 const page=(await data(await request('/api/v1/status-pages','POST',owner,a,{slug:'rest-page-'+Date.now(),title:'Scoped page'}))).data
 assert.equal((await keyed('/api/v1/maintenances/'+own.data.id,'PUT',{statusPageIds:[page.id]},env)).status,404)
 const listing=await data(await keyed('/api/v1/maintenances?limit=1'));assert.ok(listing.page.hasMore);assert.equal((await keyed('/api/v1/maintenances?limit=201')).status,400)
 await data(await keyed(endpoint,'DELETE'));assert.equal((await keyed(endpoint)).status,404)
 await prisma.apiKey.update({where:{id:write.id},data:{expires:new Date(0)}});assert.equal((await keyed('/api/v1/maintenances')).status,401)
})
test('real worker emits maintenance without HTTP and resumes after the single window ends',{timeout:12000},async()=>{
 await prisma.maintenance.deleteMany({where:{workspaceId:a.workspaceId}})
 const now=Date.now(),record=(await data(await request('/api/v1/maintenances','POST',owner,a,{title:'Actual single window',strategy:'single',startDate:new Date(now-1000).toISOString(),endDate:new Date(now+2500).toISOString(),monitorIds:[monitorId]}))).data
 await data(await request(`/api/v1/monitors/${monitorId}/resume`,'POST',owner,a));await prisma.monitor.update({where:{id:monitorId},data:{nextCheckAt:new Date(0)}})
 const wait=async(condition:()=>Promise<boolean>)=>{const end=Date.now()+5000;while(Date.now()<end){if(await condition())return;await new Promise(r=>setTimeout(r,30))}assert.fail('Worker state timeout')}
 await wait(async()=>(await prisma.monitorState.findUnique({where:{monitorId}}))?.status===3);assert.equal(hits,0)
 await new Promise(r=>setTimeout(r,Math.max(0,now+2600-Date.now())));await prisma.monitor.update({where:{id:monitorId},data:{nextCheckAt:new Date(0)}});await wait(async()=>(await prisma.monitorState.findUnique({where:{monitorId}}))?.status===1);assert.ok(hits>=1)
 await data(await request(`/api/v1/monitors/${monitorId}/pause`,'POST',owner,a));await data(await request('/api/v1/maintenances/'+record.id,'DELETE',owner,a))
})
