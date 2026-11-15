import {test} from 'node:test'
import assert from 'node:assert/strict'
import net from 'node:net'
import {user,workspace,request,data,cleanup,prisma,type Identity,type Scope} from './helpers/http'
import {rollupBatch} from '../server/services/uptime/rollup'
import {projectTLSCache} from '../server/utils/tls-cache'
test('published badges return safe SVG, bounded rollup averages and cached TLS without any outbound probe',async()=>{
 let owner:Identity|undefined,scope:Scope|undefined,hits=0;const server=net.createServer(socket=>{hits++;socket.destroy()});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
 try{
  owner=await user('badges');scope=await workspace(owner,'Badge fixtures');const port=(server.address() as net.AddressInfo).port
  const make=async(name:string)=>(await data(await request('/api/v1/monitors','POST',owner,scope,{name,type:'http',url:`https://127.0.0.1:${port}/?token=BADGE_SECRET`,active:false,interval:60,timeout:2}))).data.id as number
  const id=await make('Published'),privateId=await make('Private'),slug='badges-'+Date.now()
  await data(await request('/api/v1/status-pages','POST',owner,scope,{slug,title:'Badge page',published:true}));await data(await request(`/api/v1/status-pages/${slug}`,'PUT',owner,scope,{publicGroupList:[{id:-1,name:'Public',monitorList:[{id}]}]}))
  const svg=async(path:string)=>{const response=await request(path);assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/image\/svg\+xml/);const text=await response.text();assert.match(text,/<svg/);assert.ok(!text.includes('BADGE_SECRET'));return text}
  for(const tail of ['avg-response/24h','cert-exp']){assert.match(await svg(`/api/badge/${id}/${tail}`),/N\/A/);assert.equal((await request(`/api/badge/${privateId}/${tail}`)).status,404)}
  await svg(`/api/badge/${id}/uptime/400d`);await svg(`/api/badge/${id}/uptime?hours=9600`)
  const now=new Date(),old=new Date(now.getTime()-3*3600000),later=new Date(now.getTime()-2*3600000)
  const first=await prisma.heartbeat.create({data:{monitorId:id,time:old,status:1,ping:0,msg:'Up',coverageSeconds:120}})
  await prisma.heartbeat.create({data:{monitorId:id,time:later,status:1,ping:100,msg:'Up',coverageSeconds:120}})
  assert.match(await svg(`/api/badge/${id}/avg-response/4h`),/50ms/)
  await rollupBatch(prisma,{now,limit:100,hours:24});assert.ok(await prisma.heartbeatHourly.count({where:{monitorId:id}})>0)
  await prisma.heartbeat.delete({where:{id:first.id}});assert.match(await svg(`/api/badge/${id}/avg-response/4h`),/50ms/)
  await prisma.heartbeat.create({data:{monitorId:id,time:new Date(Date.now()-5000),status:1,ping:0,msg:'Up',coverageSeconds:120}});assert.match(await svg(`/api/badge/${id}/avg-response/1h`),/0ms/)
  const monitor=await prisma.monitor.findUniqueOrThrow({where:{id}}),cache=projectTLSCache({valid:false,validTo:new Date(now.getTime()+10*86400000)},monitor.configVersion,now)!
  await prisma.monitor.update({where:{id},data:{tlsInfo:{...cache}}});assert.match(await svg(`/api/badge/${id}/cert-exp`),/9 days|10 days/);assert.equal(hits,0)
  for(const path of [`/api/badge/${id}/cert-exp?color=url(x)`,`/api/badge/${id}/status?style=social`,`/api/badge/${id}/ping?label=a&label=b`,`/api/badge/${id}/uptime?hours=99999`,`/api/badge/${id}/uptime?hours=9601`,`/api/badge/${id}/uptime/401d`,`/api/badge/${id}/avg-response/401d`,`/api/badge/${id}/cert-exp?label=${'x'.repeat(129)}`])assert.equal((await request(path)).status,400)
  const attack=encodeURIComponent('</title><script>bad</script>&');for(const tail of ['status','ping','uptime','uptime/24h','avg-response/24h','cert-exp']){const xml=await svg(`/api/badge/${id}/${tail}?label=${attack}`);assert.ok(xml.includes('&lt;/title&gt;'));assert.ok(!xml.includes('<script>'))}
  for(const [key,value]of [['checkedAt','2000-01-01T00:00:00.000Z'],['configVersion',monitor.configVersion+1],['validTo','invalid']] as const){await prisma.monitor.update({where:{id},data:{tlsInfo:{...cache,[key]:value}}});assert.match(await svg(`/api/badge/${id}/cert-exp`),/N\/A/)}
  await prisma.monitor.update({where:{id},data:{tlsInfo:{...cache}}});const cloned=(await data(await request(`/api/v1/monitors/${id}/clone`,'POST',owner,scope,{}))).data;assert.equal((await prisma.monitor.findUniqueOrThrow({where:{id:cloned.id}})).tlsInfo,null)
  await data(await request(`/api/v1/monitors/${id}`,'PUT',owner,scope,{name:'New config'}));assert.equal((await prisma.monitor.findUniqueOrThrow({where:{id}})).tlsInfo,null)
  await prisma.monitor.update({where:{id},data:{tlsInfo:{...cache}}});await data(await request(`/api/v1/workspaces/${scope.workspaceId}/environments/${scope.environmentId}`,'PUT',owner,scope,{variables:{changed:'yes'}}));assert.equal((await prisma.monitor.findUniqueOrThrow({where:{id}})).tlsInfo,null)
  assert.equal(hits,0)
 }finally{await new Promise<void>(r=>server.close(()=>r()));if(owner&&scope)await cleanup([owner],[scope])}
})
