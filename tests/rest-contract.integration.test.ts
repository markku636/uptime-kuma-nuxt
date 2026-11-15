import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readdirSync} from 'node:fs'
import {user,workspace,request,data,cleanup,type Identity,type Scope} from './helpers/http'
test('OpenAPI declares only implemented route/method pairs and scoped Prometheus has no destination labels',async()=>{
 let owner:Identity|undefined,scope:Scope|undefined
 try{owner=await user('contract');scope=await workspace(owner,'REST contract');const specification=await data(await request('/api/swagger-json','GET',owner,scope));assert.equal(specification.servers[0].url,'/api')
 const implemented=new Set((readdirSync('server/api',{recursive:true}) as string[]).filter(file=>/\.(get|post|put|delete|patch)\.ts$/.test(file)).map(file=>{const method=file.match(/\.(get|post|put|delete|patch)\.ts$/)![1];return method+' /'+file.replace(/\.(get|post|put|delete|patch)\.ts$/,'').replace(/\/index$/,'').replace(/\[[^\]]+\]/g,'{param}')}))
 for(const [route,methods]of Object.entries(specification.paths))for(const method of Object.keys(methods as object)){
  assert.ok(implemented.has(method+' '+route.replace(/\{[^}]+\}/g,'{param}')),method+' '+route)
 }
 const metrics=await request('/api/v1/metrics','GET',owner,scope),text=await metrics.text();assert.equal(metrics.status,200);assert.ok(text.includes('uptime_kuma_monitors{status="paused"}'));assert.ok(!/url=|hostname=|token=/.test(text));assert.equal((await request('/api/metrics','GET',owner,scope)).status,403)
 assert.equal(specification.components.schemas.Bruno.properties.mode.default,'create');assert.equal(specification.components.schemas.Monitor.properties.url.writeOnly,true);assert.deepEqual(specification.components.schemas.MonitorUpdate.required,[]);assert.deepEqual(specification.components.schemas.MaintenanceUpdate.required,[])
 }finally{if(owner&&scope)await cleanup([owner],[scope])}
})
