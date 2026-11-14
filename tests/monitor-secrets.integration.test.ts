import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {prisma,request,data,user,workspace,cleanup,type Identity,type Scope} from './helpers/http'
let owner:Identity,viewer:Identity,scope:Scope,server:http.Server,origin:string,monitor:any
const sentinel='REQUEST_SECRET_SENTINEL'
let observed:{body:string,header:string|undefined,authorization:string|undefined}[]=[]
const rules={version:1,mode:'all',rules:[{id:'success',source:'json',path:'$.success',operator:'equals',expected:true}]}
before(async()=>{
  server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk
    observed.push({body,header:req.headers['x-secret'] as string,authorization:req.headers.authorization})
    res.setHeader('content-type','application/json')
    if(req.url==='/invalid'){res.end('not-json '+sentinel);return}
    res.end(JSON.stringify({success:req.headers['x-secret']===sentinel,sensitiveActual:sentinel}))
  })
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`
  owner=await user('request-owner');viewer=await user('request-viewer');scope=await workspace(owner,'request-secrets')
  await data(await request(`/api/v1/workspaces/${scope.workspaceId}/members`,'POST',owner,scope,{username:viewer.username,role:'viewer'}))
})
after(async()=>{
  if(monitor)await request(`/api/v1/monitors/${monitor.id}/pause`,'POST',owner,scope)
  server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))
  await cleanup([owner,viewer],[scope])
})
function safe(value:unknown){const encoded=JSON.stringify(value);assert.ok(!encoded.includes(sentinel),encoded);assert.ok(!encoded.includes('requestSecrets'))}
test('save/reload/name edit preserves encrypted request and actual authenticated HTTP behavior',async()=>{
  const response=await data(await request('/api/v1/monitors','POST',owner,scope,{name:'encrypted',type:'http',url:origin+'/?token='+sentinel,method:'POST',headers:{'X-Secret':sentinel},body:sentinel,authMethod:'basic',basicAuthUser:'user',basicAuthPass:sentinel,active:false,assertions:rules}))
  safe(response);monitor=response.data;assert.equal(monitor.configuredSecrets.url,true)
  const stored=await prisma.monitor.findUniqueOrThrow({where:{id:monitor.id}})
  assert.equal(stored.url,null);assert.equal(stored.body,null);assert.equal(stored.headers,null);assert.equal(stored.basicAuthPass,null)
  assert.ok(stored.requestSecrets?.startsWith('enc:v1:'));assert.ok(!stored.requestSecrets!.includes(sentinel))
  safe(await data(await request(`/api/v1/monitors/${monitor.id}`,'GET',owner,scope)))
  safe(await data(await request(`/api/v1/monitors/${monitor.id}`,'PUT',owner,scope,{name:'renamed'})))
  const trial=await data(await request(`/api/v1/monitors/${monitor.id}/test`,'POST',owner,scope,{}))
  safe(trial);assert.equal(trial.data.status,1);assert.equal(trial.data.assertionResults.rules[0].passed,true)
  assert.equal(observed.at(-1)!.body,sentinel);assert.equal(observed.at(-1)!.authorization,'Basic '+Buffer.from('user:'+sentinel).toString('base64'))
})
test('clone rebinds authenticated ciphertext and explicit clear/replacement updates only chosen values',async()=>{
  const clone=await data(await request(`/api/v1/monitors/${monitor.id}/clone`,'POST',owner,scope))
  safe(clone);assert.equal(clone.data.active,false)
  const copy=await prisma.monitor.findUniqueOrThrow({where:{id:clone.data.id}}),original=await prisma.monitor.findUniqueOrThrow({where:{id:monitor.id}})
  assert.notEqual(copy.requestSecrets,original.requestSecrets)
  assert.equal((await data(await request(`/api/v1/monitors/${copy.id}/test`,'POST',owner,scope,{}))).data.status,1)
  await data(await request(`/api/v1/monitors/${monitor.id}`,'PUT',owner,scope,{clearSecrets:['body','basicAuthPass'],headers:{'X-Secret':'replacement'}}))
  const trial=await data(await request(`/api/v1/monitors/${monitor.id}/test`,'POST',owner,scope,{}))
  assert.equal(trial.data.status,0);assert.equal(observed.at(-1)!.body,'');assert.equal(observed.at(-1)!.header,'replacement')
  safe(trial)
})
test('only scoped static and encrypted variables resolve; invalid JSON cannot be hidden by any/inversion',async()=>{
  await data(await request(`/api/v1/workspaces/${scope.workspaceId}/environments/${scope.environmentId}`,'PUT',owner,scope,{variables:{origin},secrets:{apiToken:sentinel}}))
  const input={name:'variable-check',type:'http',url:'{{origin}}/',headers:{'X-Secret':'{{apiToken}}'},assertions:rules,active:false}
  const trial=await data(await request('/api/v1/monitors/test','POST',owner,scope,input));assert.equal(trial.data.status,1);safe(trial)
  const invalid=await data(await request('/api/v1/monitors/test','POST',owner,scope,{...input,url:'{{origin}}/invalid',upsideDown:true,assertions:{version:1,mode:'any',rules:[{id:'status',source:'status',operator:'equals',expected:200},...rules.rules]}}))
  assert.equal(invalid.data.status,0);assert.equal(invalid.data.code,'INVALID_JSON');safe(invalid)
  assert.equal((await request('/api/v1/monitors/test','POST',viewer,scope,input)).status,403)
  const unknown=await data(await request('/api/v1/monitors/test','POST',owner,scope,{...input,url:'{{process.env.HOME}}'}));assert.equal(unknown.data.code,'CONFIG_ERROR')
})
test('scheduled checks persist safe assertion history and bounded API bodies reject oversized configuration',async()=>{
  await data(await request(`/api/v1/monitors/${monitor.id}`,'PUT',owner,scope,{headers:{'X-Secret':sentinel},active:true}))
  await prisma.monitor.update({where:{id:monitor.id},data:{nextCheckAt:new Date(Date.now()-100)}})
  let heartbeat:any
  for(let i=0;i<80;i++){heartbeat=await prisma.heartbeat.findFirst({where:{monitorId:monitor.id},orderBy:{time:'desc'}});if(heartbeat)break;await new Promise(r=>setTimeout(r,50))}
  assert.equal(heartbeat?.status,1);assert.equal(heartbeat.checkCode,'CHECK_OK');assert.equal(heartbeat.assertionResults.rules[0].passed,true)
  const history=await data(await request(`/api/v1/monitors/${monitor.id}/heartbeats`,'GET',owner,scope));safe(history);assert.equal(history.data[0].assertionResults.rules[0].passed,true)
  await data(await request(`/api/v1/monitors/${monitor.id}/pause`,'POST',owner,scope))
  const bad=await request('/api/v1/monitors','POST',owner,scope,{name:'bad-headers',type:'http',url:origin,headers:{'X-Nonempty':'valid'},active:false})
  assert.equal(bad.status,200,await bad.text())
  const large=await request('/api/v1/monitors/test','POST',owner,scope,{name:'large',type:'http',url:origin,body:'x'.repeat(3*1024*1024)})
  assert.equal(large.status,413)
})
