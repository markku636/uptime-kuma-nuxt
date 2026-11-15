import fs from 'node:fs'
import assert from 'node:assert/strict'
const credentials=JSON.parse(fs.readFileSync('.data/k8s-demo-credentials.json','utf8'))
const base=credentials.baseUrl,workspaceId=credentials.workspaceId,originalEnv=credentials.environmentId
if(!base.startsWith('http://192.168.50.57:32480'))throw Error('Unexpected owned deployment target')
const report={startedAt:new Date().toISOString(),target:base,checks:[],owned:{environmentIds:[],monitorIds:[],keyIds:[],maintenanceIds:[]},cleanup:[],passed:false}
const reportPath='.data/validation-logs/final-live-rest.json',ownedPath='.data/validation-logs/final-live-rest-owned.json'
const persist=()=>{fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');fs.writeFileSync(ownedPath,JSON.stringify(report.owned,null,2)+'\n',{mode:0o600})}
const own=(type,id,environmentId)=>{report.owned[type].push(environmentId?{id,environmentId}:id);persist();return id}
let cookie='',env=originalEnv
async function call(path,method='GET',body,expected=200,key){
 const response=await fetch(base+path,{method,signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json','x-workspace-id':String(workspaceId),'x-environment-id':String(env),...(key?{'x-api-key':key}:{cookie})},...(body===undefined?{}:{body:JSON.stringify(body)})})
 if(response.status!==expected){let reason='';if(response.status===503){try{const error=await response.json();reason=String(error.message||error.statusMessage||'').slice(0,160)}catch{}}throw Error(`${method} ${path.split('?')[0]} expected ${expected}, received ${response.status}${reason?': '+reason:''}`)}
 const text=await response.text();return text?JSON.parse(text):undefined
}
const list=async()=> (await call('/api/v1/monitors?limit=200')).data
const snapshot=rows=>rows.map(({id,name,active,workspaceId,environmentId})=>({id,name,active,workspaceId,environmentId})).sort((a,b)=>a.id-b.id)
let before,originalEnvironments
try{
 const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:credentials.username,password:credentials.password}),signal:AbortSignal.timeout(10000)})
 if(response.status!==200)throw Error('Deployment login failed')
 cookie=response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
 before=snapshot(await list());assert.equal(before.length,5);assert.ok(before.every(row=>row.active===false));report.originalBefore=before
 originalEnvironments=(await call(`/api/v1/workspaces/${workspaceId}/environments`)).data.map(row=>row.id).sort((a,b)=>a-b)
 const a=own('environmentIds',(await call(`/api/v1/workspaces/${workspaceId}/environments`,'POST',{name:'Final REST A '+Date.now()})).data.id)
 const b=own('environmentIds',(await call(`/api/v1/workspaces/${workspaceId}/environments`,'POST',{name:'Final REST B '+Date.now()})).data.id);env=a
 const key=async scope=>{const record=await call('/api/v1/api-keys','POST',{name:'Final REST '+scope,scope,environmentId:a});own('keyIds',record.id);return record.key}
 const read=await key('read'),write=await key('write')
 const config={name:'Final owned monitor',type:'http',url:'http://uptime-fixture:3000/health',headers:{'x-final-validation':'owned'},active:false,interval:10,timeout:2,assertions:{version:1,mode:'all',rules:[{id:'status',source:'status',operator:'equals',expected:200}]}}
 await call('/api/v1/monitors','POST',config,403,read)
 const id=own('monitorIds',(await call('/api/v1/monitors','POST',config,200,write)).data.id,a)
 assert.equal((await call(`/api/v1/monitors/${id}`,'GET',undefined,200,read)).data.id,id)
 await call(`/api/v1/monitors/${id}`,'PUT',{name:'Final renamed'},200,write)
 assert.equal((await call(`/api/v1/monitors/${id}`)).data.name,'Final renamed')
 env=b;await call(`/api/v1/monitors/${id}`,'GET',undefined,404);await call('/api/v1/monitors','GET',undefined,404,write);env=a
 const trial=(await call(`/api/v1/monitors/${id}/test`,'POST',{})).data;assert.equal(trial.status,1);assert.equal(trial.assertionResults.rules.length,1)
 report.checks.push('monitor CRUD, typed assertion trial, read/write key scope and cross-environment denial')
 const manifest={collectionId:'final-live-'+Date.now(),mode:'create',files:[{path:'health.bru',content:'meta {\n name: Final declarative import\n type: http\n}\nget {\n url: http://uptime-fixture:3000/health\n body: none\n auth: none\n}\nassert {\n res.status: eq 200\n}\n'}]}
 const preview=await call('/api/v1/bruno/preview','POST',manifest);assert.equal(preview.ok,true);assert.equal(preview.counts.create,1)
 const imported=await call('/api/v1/bruno/import','POST',{...manifest,digest:preview.digest});for(const mid of imported.data.createdIds)own('monitorIds',mid,a)
 const brunoId=imported.data.createdIds[0];assert.equal((await call(`/api/v1/monitors/${brunoId}`)).data.active,false)
 assert.equal((await call(`/api/v1/monitors/${brunoId}/test`,'POST',{})).data.status,1)
 const exported=await call(`/api/v1/bruno/export?ids=${brunoId}`);assert.ok(exported.data.files.some(file=>file.content.includes('res.status')));assert.ok(exported.data.secretNames.length>0)
 const unsafe={...manifest,collectionId:'rejected-live',files:[{path:'unsafe.bru',content:manifest.files[0].content+'script:pre-request {\n throw new Error("disabled")\n}\n'}]};assert.equal((await call('/api/v1/bruno/preview','POST',unsafe)).ok,false)
 report.checks.push('Bruno declarative preview/import paused/export/assertion trial and scripts rejected')
 const maintenance=(await call('/api/v1/maintenances','POST',{title:'Final owned manual guard',strategy:'manual',active:false,startDate:'2000-01-01T00:00:00.000Z',endDate:'2000-01-02T00:00:00.000Z',monitorIds:[id]})).data
 const mid=own('maintenanceIds',maintenance.id,a);assert.equal(maintenance.status,'inactive')
 await call(`/api/v1/monitors/${id}/resume`,'POST',{},200,write)
 const resumed=await call(`/api/v1/maintenances/${mid}/resume`,'POST',{});assert.equal(resumed.data.status,'under-maintenance')
 const deadline=Date.now()+15000;let state
 while(Date.now()<deadline){state=(await list()).find(row=>row.id===id)?.state;if(state?.status===3)break;await new Promise(resolve=>setTimeout(resolve,200))}
 assert.equal(state?.status,3);report.manualState={status:state.status,checkCode:state.checkCode}
 await call(`/api/v1/monitors/${id}/pause`,'POST',{},200,write)
 assert.equal((await call(`/api/v1/maintenances/${mid}/pause`,'POST',{})).data.status,'inactive')
 await call(`/api/v1/monitors/${brunoId}`,'DELETE');assert.equal((await list()).length,1)
 report.checks.push('manual inactive/resume/worker maintenance with retained historical dates/pause guard')
 report.passed=true
}catch(error){report.error=String(error.message);report.passed=false}
finally{
 const cleanup=async(path,type,id)=>{try{await call(path,'DELETE');report.cleanup.push({type,id,deleted:true})}catch(error){if(String(error.message).includes('received 404'))report.cleanup.push({type,id,alreadyAbsent:true});else{report.cleanup.push({type,id,error:String(error.message)});report.passed=false}}persist()}
 for(const row of report.owned.maintenanceIds){env=row.environmentId;await cleanup(`/api/v1/maintenances/${row.id}`,'maintenance',row.id)}
 for(const row of report.owned.monitorIds){env=row.environmentId;await cleanup(`/api/v1/monitors/${row.id}`,'monitor',row.id)}
 env=originalEnv;for(const id of report.owned.keyIds)await cleanup(`/api/v1/api-keys/${id}`,'api-key',id)
 for(const id of [...report.owned.environmentIds].reverse())await cleanup(`/api/v1/workspaces/${workspaceId}/environments/${id}`,'environment',id)
 if(before){try{report.originalAfter=snapshot(await list());assert.deepEqual(report.originalAfter,before);assert.deepEqual((await call(`/api/v1/workspaces/${workspaceId}/environments`)).data.map(row=>row.id).sort((a,b)=>a-b),originalEnvironments);report.originalDemosUnchanged=true}catch(error){report.passed=false;report.cleanupVerificationError=String(error.message)}}
 report.finishedAt=new Date().toISOString();persist();console.info(JSON.stringify({passed:report.passed,checks:report.checks,created:{environments:report.owned.environmentIds.length,monitors:report.owned.monitorIds.length,keys:report.owned.keyIds.length,maintenances:report.owned.maintenanceIds.length},cleanupComplete:report.cleanup.every(row=>row.deleted||row.alreadyAbsent),originalDemosUnchanged:report.originalDemosUnchanged,error:report.error}));if(!report.passed)process.exitCode=1
}
