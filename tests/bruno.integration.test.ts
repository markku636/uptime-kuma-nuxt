import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {readFile,readdir} from 'node:fs/promises'
import type {BrunoFile,BrunoManifest} from '../shared/types/bruno'
import {prisma,request,data,user,workspace,cleanup,type Identity,type Scope} from './helpers/http'
let owner:Identity,editor:Identity,viewer:Identity,a:Scope,b:Scope,server:http.Server,origin:string,manifest:BrunoManifest,monitorId:number,hits=0
const secret='BRUNO_SECRET&with=#reserved{{literal}}'
async function files(root='tests/fixtures/bruno/nested',prefix=''):Promise<BrunoFile[]>{
  const result:BrunoFile[]=[]
  for(const entry of await readdir(root+'/'+prefix,{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())result.push(...await files(root,path+'/'));else result.push({path,content:await readFile(root+'/'+path,'utf8')})}
  return result
}
const basic=(name='Bulk')=>`meta {\n name: ${name}\n type: http\n}\nget {\n url: ${origin}/health\n body: none\n auth: none\n}\nassert {\n res.status: eq 200\n}\n`
async function preview(input:BrunoManifest,scope=a,identity=owner){return data(await request('/api/v1/bruno/preview','POST',identity,scope,input))}
async function commit(input:BrunoManifest,digest:string,scope=a,identity=owner){return request('/api/v1/bruno/import','POST',identity,scope,{...input,digest})}
function safe(value:unknown){assert.ok(!JSON.stringify(value).includes('BRUNO_SECRET'))}
before(async()=>{
  server=http.createServer(async(req,res)=>{
    hits++;let body='';for await(const chunk of req)body+=chunk
    const url=new URL(req.url!,'http://localhost')
    const success=req.headers.authorization==='Basic '+Buffer.from('fixture:'+secret).toString('base64')&&url.searchParams.get('token')===secret&&JSON.parse(body||'{}').scope==='request'&&req.headers['x-scope']==='request'
    res.setHeader('content-type','application/json');res.setHeader('x-fixture','ready');res.end(JSON.stringify({success,hiddenActual:secret}))
  })
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`
  owner=await user('bruno-owner');editor=await user('bruno-editor');viewer=await user('bruno-viewer');a=await workspace(owner,'Bruno target');b=await workspace(owner,'Bruno other')
  for(const [identity,role]of [[editor,'editor'],[viewer,'viewer']] as const)await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`,'POST',owner,a,{username:identity.username,role}))
  manifest={collectionId:'official-fixture-subset',sourceEnvironment:'environments/local.bru',mode:'create',files:await files(),variables:{origin},secrets:{token:secret}}
})
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await cleanup([owner,editor,viewer],[a,b])})
test('preview is secret-free and write-free; commit is paused and emits no outbound requests',async()=>{
  const count=await prisma.monitor.count({where:{workspaceId:a.workspaceId}}),result=await preview(manifest)
  safe(result);assert.equal(result.ok,true,JSON.stringify(result.issues));assert.equal(result.counts.create,1);assert.equal(await prisma.monitor.count({where:{workspaceId:a.workspaceId}}),count);assert.equal(hits,0)
  const saved=await data(await commit(manifest,result.digest));safe(saved);monitorId=saved.data.createdIds[0]
  const row=await prisma.monitor.findUniqueOrThrow({where:{id:monitorId}})
  assert.equal(row.active,false);assert.equal(row.url,null);assert.equal(row.headers,null);assert.equal(row.body,null);assert.ok(!JSON.stringify(row,(_key,value)=>typeof value==='bigint'?String(value):value).includes('BRUNO_SECRET'))
  const environment=await prisma.environment.findUniqueOrThrow({where:{id:a.environmentId}});assert.ok(!JSON.stringify(environment.secrets).includes('BRUNO_SECRET'))
  assert.equal(hits,0)
  const trial=await data(await request(`/api/v1/monitors/${monitorId}/test`,'POST',owner,a,{}));safe(trial);assert.equal(trial.data.status,1);assert.equal(trial.data.assertionResults.rules.length,3);assert.equal(hits,1)
})
test('create/skip/replace uses source identity and retains matching monitor IDs',async()=>{
  const duplicate=await preview(manifest);assert.equal(duplicate.ok,false);assert.ok(duplicate.issues.some((issue:any)=>issue.code==='ALREADY_IMPORTED'))
  const skip={...manifest,mode:'skip' as const},skipped=await preview(skip);assert.equal(skipped.counts.skip,1)
  await data(await request(`/api/v1/monitors/${monitorId}`,'PUT',owner,a,{name:'Local edit'}))
  const skipAfterEdit=await preview(skip)
  assert.equal((await commit(skip,skipped.digest)).status,409)
  const skipResult=await data(await commit(skip,skipAfterEdit.digest));assert.deepEqual(skipResult.data.skippedIds,[monitorId]);assert.equal((await prisma.monitor.findUniqueOrThrow({where:{id:monitorId}})).name,'Local edit')
  const replacement={...manifest,mode:'replace' as const},checked=await preview(replacement),replaced=await data(await commit(replacement,checked.digest))
  assert.deepEqual(replaced.data.replacedIds,[monitorId]);assert.equal((await prisma.monitor.findUniqueOrThrow({where:{id:monitorId}})).name,'Health')
  assert.equal(hits,1)
})
test('preview digest binds original files, principal, workspace, environment and current state',async()=>{
  const input={...manifest,mode:'skip' as const},checked=await preview(input)
  const tampered={...input,files:input.files.map(file=>file.path.endsWith('health.bru')?{...file,content:file.content.replace('Health','Tampered')}:file)}
  assert.equal((await commit(tampered,checked.digest)).status,409)
  assert.equal((await commit(input,checked.digest,b)).status,409)
  const env=await prisma.environment.findUniqueOrThrow({where:{id:a.environmentId}})
  await data(await request(`/api/v1/workspaces/${a.workspaceId}/environments/${a.environmentId}`,'PUT',owner,a,{variables:{...env.variables as object,stateChanged:'true'}}))
  assert.equal((await commit(input,checked.digest)).status,409)
  const foreign=await preview({...manifest,collectionId:'isolated-other'},b);const imported=await data(await commit({...manifest,collectionId:'isolated-other'},foreign.digest,b))
  assert.notEqual(imported.data.createdIds[0],monitorId)
})
test('viewer/read keys cannot import; editor can reuse environment but cannot alter secrets',async()=>{
  assert.equal((await request('/api/v1/bruno/preview','POST',viewer,a,manifest)).status,403)
  const key=await data(await request('/api/v1/api-keys','POST',owner,a,{name:'Bruno read',scope:'read'}))
  assert.equal((await request('/api/v1/bruno/preview','POST',undefined,a,manifest,{'x-api-key':key.key})).status,403)
  const tainted={...manifest,collectionId:'owner-taint-blocked',variables:{origin,publicAlias:'{{token}}'}}
  const taintPreview=await preview(tainted);assert.equal(taintPreview.ok,false);safe(taintPreview);assert.ok(taintPreview.issues.some((issue:any)=>issue.code==='SECRET_TO_STATIC_VARIABLE'))
  assert.equal((await commit(tainted,taintPreview.digest)).status,400)
  assert.ok(!Object.hasOwn((await prisma.environment.findUniqueOrThrow({where:{id:a.environmentId}})).variables as object,'publicAlias'))
  const changes={...manifest,collectionId:'editor-blocked',secrets:{token:'different'}}
  const denied=await preview(changes,a,editor);assert.equal(denied.ok,false);assert.ok(denied.issues.some((issue:any)=>issue.code==='OWNER_REQUIRED_FOR_ENVIRONMENT'))
  assert.equal((await commit(changes,denied.digest,a,editor)).status,400)
  const reused={...manifest,collectionId:'editor-reuses-existing'},allowed=await preview(reused,a,editor)
  assert.equal(allowed.ok,true,JSON.stringify(allowed.issues));assert.equal((await data(await commit(reused,allowed.digest,a,editor))).data.createdIds.length,1)
})
test('invalid paths/expressions are explicit, secret-free and never persisted',async()=>{
  const count=await prisma.monitor.count({where:{workspaceId:a.workspaceId}})
  for(const file of [{path:'../outside.bru',content:basic()},{path:'assert.bru',content:basic().replace('eq 200','eq process.env.BRUNO_SECRET')}]){
    const input={collectionId:'unsafe',mode:'create' as const,files:[file]},result=await preview(input)
    assert.equal(result.ok,false);safe(result);assert.equal((await commit(input,result.digest)).status,400)
  }
  assert.equal(await prisma.monitor.count({where:{workspaceId:a.workspaceId}}),count)
})
test('scripts are flagged, never echoed and never executed by preview',async()=>{
  const before=hits,count=await prisma.monitor.count({where:{workspaceId:a.workspaceId}})
  const input={collectionId:'scripted',mode:'create' as const,targetGroup:'none' as const,files:[{path:'script.bru',content:basic()+'script:pre-request {\n throw BRUNO_SECRET\n}\n'}]},result=await preview(input)
  assert.equal(result.ok,true);safe(result);assert.deepEqual(result.requests[0].skipped,['script'])
  assert.equal(hits,before);assert.equal(await prisma.monitor.count({where:{workspaceId:a.workspaceId}}),count)
})
test('database failure after a prior create batch rolls back monitors, source mappings and environment changes',async()=>{
  const name='bruno_rollback_'+a.workspaceId,count=await prisma.monitor.count({where:{workspaceId:a.workspaceId}})
  await prisma.$executeRawUnsafe(`ALTER TABLE monitors ADD CONSTRAINT "${name}" CHECK (workspace_id <> ${a.workspaceId} OR name <> 'Rollback marker') NOT VALID`)
  try{
    const input:BrunoManifest={collectionId:'rollback-proof',mode:'create',variables:{rollbackMarker:'must-not-persist'},files:Array.from({length:251},(_,index)=>({path:`rollback/${index}.bru`,content:basic(index===250?'Rollback marker':'Before failure')}))}
    const checked=await preview(input);assert.equal(checked.ok,true,JSON.stringify(checked.issues))
    const response=await commit(input,checked.digest);assert.equal(response.status,500);safe(await response.json())
    assert.equal(await prisma.monitor.count({where:{workspaceId:a.workspaceId}}),count)
    assert.equal(await prisma.brunoSource.count({where:{workspaceId:a.workspaceId,collectionId:'rollback-proof'}}),0)
    const env=await prisma.environment.findUniqueOrThrow({where:{id:a.environmentId}});assert.ok(!Object.hasOwn(env.variables as object,'rollbackMarker'))
  }finally{await prisma.$executeRawUnsafe(`ALTER TABLE monitors DROP CONSTRAINT "${name}"`)}
})
test('export exposes placeholders and safe definitions; reparsed requests can be imported with supplied values',async()=>{
  const response=await data(await request(`/api/v1/bruno/export?ids=${monitorId}`,'GET',owner,a));safe(response)
  assert.ok(response.data.secretNames.length>0);assert.ok(response.data.files.some((file:any)=>file.path==='environments/configure.bru'))
  const secrets=Object.fromEntries(response.data.secretNames.map((name:string)=>[name,name.endsWith('_url')?origin+'/health':name.endsWith('_username')?'fixture':name.endsWith('_password')?secret:name.endsWith('_body')?'{}':'configure']))
  const {files,sourceEnvironment}=response.data,input:BrunoManifest={collectionId:'export-roundtrip',mode:'create',files,sourceEnvironment,secrets}
  const checked=await preview(input);assert.equal(checked.ok,true,JSON.stringify(checked.issues));safe(checked)
  const imported=await data(await commit(input,checked.digest));assert.equal(imported.data.createdIds.length,1);assert.equal((await prisma.monitor.findUniqueOrThrow({where:{id:imported.data.createdIds[0]}})).active,false)
})
test('4000 distinct paths with the same display name commit atomically in paused batches',{timeout:120000,skip:process.env.TEST_INCLUDE_SCALE!=='true'},async()=>{
  const beforeHits=hits,input:BrunoManifest={collectionId:'4000-local-paused',mode:'create',files:Array.from({length:4000},(_,index)=>({path:`bulk/request-${String(index).padStart(4,'0')}.bru`,content:basic()}))}
  const start=performance.now(),checked=await preview(input);assert.equal(checked.ok,true,JSON.stringify(checked.issues));assert.equal(checked.counts.create,4000)
  const imported=await data(await commit(input,checked.digest));assert.equal(imported.data.createdIds.length,4000)
  assert.equal(await prisma.monitor.count({where:{id:{in:imported.data.createdIds},active:false}}),4000)
  assert.equal(await prisma.brunoSource.count({where:{workspaceId:a.workspaceId,collectionId:input.collectionId}}),4000)
  assert.equal(hits,beforeHits)
  console.info(`Bruno 4000 preview+atomic commit: ${Math.round(performance.now()-start)}ms; outbound delta=0`)
})
