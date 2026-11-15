import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import path from 'node:path'
const credentials=JSON.parse(readFileSync(process.env.DEMO_CREDENTIALS_FILE||'.data/validation-credentials.json','utf8')),statePath=process.env.DEMO_OWNERSHIP_FILE||'.data/demo-owned.json',base=process.env.DEMO_API_URL||credentials.baseUrl,target=process.env.DEMO_FIXTURE_URL||'http://127.0.0.1:32525'
if(!['127.0.0.1','localhost','uptime-fixture'].includes(new URL(target).hostname))throw Error('Demo target must be the owned local/cluster fixture')
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:credentials.username,password:credentials.password})});if(!login.ok)throw Error('Demo login failed')
const cookie=login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; '),headers={'content-type':'application/json',cookie,'x-workspace-id':String(credentials.workspaceId),'x-environment-id':String(credentials.environmentId)}
async function api(endpoint:string,method='GET',body?:any){const response=await fetch(base+endpoint,{method,headers,...(body?{body:JSON.stringify(body)}:{})});if(!response.ok)throw Error('Demo request failed: '+response.status);return response.json()}
if(existsSync(statePath)){
 const owned=JSON.parse(readFileSync(statePath,'utf8'));if(owned.workspaceId!==credentials.workspaceId||owned.environmentId!==credentials.environmentId||owned.baseUrl&&owned.baseUrl!==base)throw Error('Ownership belongs to a different database/scope')
 for(const id of owned.monitorIds)await api('/api/v1/monitors/'+id)
 console.info('Existing five demo IDs verified; no data changed')
}else{
 const definitions=[{name:'Demo · HTTP 200',path:'/health',rule:{source:'status',operator:'equals',expected:200}},{name:'Demo · JSON contract',path:'/json',rule:{source:'json',path:'$.health',operator:'equals',expected:'ready'}},{name:'Demo · Response headers',path:'/headers',rule:{source:'header',path:'x-api-state',operator:'equals',expected:'ready'}},{name:'Demo · Latency budget',path:'/slow',rule:{source:'responseTime',operator:'lt',expected:1000}},{name:'Demo · Assertion failure',path:'/fail',rule:{source:'status',operator:'equals',expected:200}}]
 const owned:any={userId:credentials.userId,workspaceId:credentials.workspaceId,environmentId:credentials.environmentId,monitorIds:[],baseUrl:base,fixtureTarget:target,paused:true,createdAt:new Date().toISOString()};mkdirSync(path.dirname(statePath),{recursive:true})
 const persist=()=>writeFileSync(statePath,JSON.stringify(owned,null,2)+'\n',{mode:0o600})
 for(const definition of definitions){const response=await api('/api/v1/monitors','POST',{name:definition.name,type:'http',active:false,url:target+definition.path,interval:60,timeout:3,assertions:{version:1,mode:'all',rules:[{id:'demo-rule',...definition.rule}]}});owned.monitorIds.push(response.data.id);persist()}
 const page=await api('/api/v1/status-pages','POST',{title:'API monitoring demo',slug:'api-platform-demo',published:true});owned.statusPageId=page.data.id;persist()
 await api('/api/v1/status-pages/api-platform-demo','PUT',{perPage:5,publicGroupList:[{id:0,name:'API examples',monitorList:owned.monitorIds.map((id:number)=>({id}))}]});console.info('Created five paused demos and linked public status page')
}
