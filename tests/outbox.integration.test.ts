import {test,before,after,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import pg from 'pg'
import {PrismaClient} from '@prisma/client'
import http from 'node:http'
import {WorkerProcess,workerChildren} from './helpers/worker-process'
import {sealResource,reserveResourceId} from '../server/utils/resource-secrets'
import {monitorDbInput} from '../server/utils/monitor-secrets'
import {claimMonitors} from '../server/services/monitor/leases'
import {completeMonitorRun} from '../server/services/monitor/completion'
const adminURL=process.env.TEST_PG_ADMIN_URL||'postgresql://postgres@127.0.0.1:55464/postgres'
if(!['127.0.0.1','localhost'].includes(new URL(adminURL).hostname))throw Error('Outbox tests require local disposable PostgreSQL')
process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
let admin:pg.Client,db:PrismaClient,url:string,name:string,owner:number,workspaceId:number,environmentId:number,monitorId:number,server:http.Server,origin:string,hits=0,open=0
const bodies:string[]=[],pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function until(condition:()=>Promise<boolean>|boolean,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await condition())return;await pause(20)}assert.fail('Timed out waiting for outbox fixture')}
async function channel(path='/success',type='webhook',active=true,scope=workspaceId){
  return db.$transaction(async tx=>{const id=await reserveResourceId(tx,'notification'),row={id,name:'Private channel',workspaceId:scope,userId:owner,type,config:{url:origin+path+'?token=CHANNEL_SECRET',headers:{authorization:'CHANNEL_SECRET'}},active};return tx.notification.create({data:{...row,...sealResource('notification',row)}})})
}
async function event(notificationId:number){return db.notificationOutbox.create({data:{runId:crypto.randomUUID(),eventType:'status',notificationId,workspaceId,environmentId,monitorId,payload:{monitorId,name:'Safe monitor',status:0,ping:1,code:'HTTP_STATUS',time:new Date().toISOString()}}})}
before(async()=>{
  admin=new pg.Client({connectionString:adminURL});await admin.connect();name='uptime_outbox_'+Date.now();await admin.query(`CREATE DATABASE "${name}"`);const parsed=new URL(adminURL);parsed.pathname='/'+name;parsed.searchParams.set('connection_limit','4');url=parsed.toString()
  const migration=spawn(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:url},stdio:'ignore'});assert.equal(await new Promise(r=>migration.once('exit',r)),0)
  db=new PrismaClient({datasourceUrl:url});owner=(await db.user.create({data:{username:'outbox-fixture',password:'unused'}})).id
  const workspace=await db.workspace.create({data:{name:'Outbox',members:{create:{userId:owner,role:'owner'}},environments:{create:{name:'default'}}},include:{environments:true}});workspaceId=workspace.id;environmentId=workspace.environments[0]!.id
  monitorId=(await db.monitor.create({data:{name:'Safe monitor',userId:owner,workspaceId,environmentId,type:'http',active:false}})).id
  server=http.createServer(async(req,res)=>{
    hits++;open++;let body='';res.once('close',()=>open--);for await(const chunk of req)body+=chunk;bodies.push(body)
    if(req.url?.startsWith('/hang'))return
    if(req.url?.startsWith('/failure'))res.writeHead(500)
    res.end('PROVIDER_RESPONSE_SECRET')
  });await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`
})
beforeEach(async()=>{for(const child of workerChildren){child.kill('SIGKILL');workerChildren.delete(child)}await db.notificationOutbox.deleteMany();await db.notification.deleteMany();hits=0;bodies.length=0})
after(async()=>{for(const child of workerChildren)child.kill('SIGKILL');server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await db.$disconnect();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end()})
test('independent dispatcher claims race and reject stale renew/ack after expiry',{timeout:30000},async()=>{
  const target=await event((await channel()).id),a=new WorkerProcess(url),b=new WorkerProcess(url)
  try{
    const claims=await Promise.all([a.call('outboxClaim',{leaseMs:300}),b.call('outboxClaim',{leaseMs:300})]);assert.equal(claims.reduce((n,x)=>n+x.rows.length,0),1)
    const first=claims[0].rows.length?a:b,second=first===a?b:a,original=claims.find(x=>x.rows.length)!.rows[0];await pause(350)
    const replacement=(await second.call('outboxClaim',{leaseMs:2000})).rows[0];assert.equal(replacement.id,String(target.id));assert.equal(BigInt(replacement.leaseToken),BigInt(original.leaseToken)+1n)
    assert.equal((await first.call('outboxRenew')).renewed,false);assert.equal((await first.call('outboxAck')).accepted,false);assert.equal((await second.call('outboxAck')).accepted,true)
    assert.equal((await db.notificationOutbox.findUniqueOrThrow({where:{id:target.id}})).status,'delivered');assert.equal(hits,0)
  }finally{await a.stop();await b.stop()}
})
test('delivery hydrates channel, bounds timeout/retries, cancels disabled channels and dead-letters unsupported providers',{timeout:30000},async()=>{
  const success=await event((await channel()).id),failed=await event((await channel('/failure')).id),timeout=await event((await channel('/hang')).id),disabled=await event((await channel('/success','webhook',false)).id),smtp=await event((await channel('/success','email')).id)
  const a=new WorkerProcess(url,{NOTIFICATION_CONCURRENCY:'2',NOTIFICATION_TIMEOUT_MS:'200',OUTBOX_BACKOFF_MS:'50',OUTBOX_MAX_ATTEMPTS:'3'}),b=new WorkerProcess(url,{NOTIFICATION_CONCURRENCY:'2',NOTIFICATION_TIMEOUT_MS:'200',OUTBOX_BACKOFF_MS:'50',OUTBOX_MAX_ATTEMPTS:'3'})
  try{
    await Promise.all([a.call('dispatch'),b.call('dispatch')]);await until(async()=>await db.notificationOutbox.count({where:{status:{in:['pending','processing']}}})===0)
    const rows=await db.notificationOutbox.findMany(),byId=new Map(rows.map(row=>[String(row.id),row]))
    assert.equal(byId.get(String(success.id))!.status,'delivered');assert.equal(byId.get(String(success.id))!.attempts,1)
    for(const row of [failed,timeout]){assert.equal(byId.get(String(row.id))!.status,'dead');assert.equal(byId.get(String(row.id))!.attempts,3)}
    assert.equal(byId.get(String(disabled.id))!.status,'cancelled');assert.equal(byId.get(String(smtp.id))!.errorCode,'UNSUPPORTED_PROVIDER');assert.equal(byId.get(String(smtp.id))!.status,'dead')
    assert.equal(hits,7);await until(()=>open===0,1000)
    assert.ok(!JSON.stringify(rows,(_k,v)=>typeof v==='bigint'?String(v):v).includes('CHANNEL_SECRET'))
    assert.ok(!JSON.stringify(rows,(_k,v)=>typeof v==='bigint'?String(v):v).includes('PROVIDER_RESPONSE_SECRET'));assert.ok(bodies.every(body=>!body.includes('CHANNEL_SECRET')))
  }finally{await a.stop();await b.stop()}
})
test('accepted state transition queues only workspace channels and TLS threshold dedupes across runs',{timeout:15000},async()=>{
  const own=await channel(),otherWorkspace=await db.workspace.create({data:{name:'Other',environments:{create:{name:'default'}}}}),foreign=await channel('/foreign','webhook',true,otherWorkspace.id)
  await db.notification.updateMany({where:{id:{in:[own.id,foreign.id]}},data:{isDefault:true}})
  await db.monitorNotification.create({data:{monitorId,notificationId:foreign.id}})
  await db.monitor.update({where:{id:monitorId},data:{active:true,expiryNotification:true,tlsExpiryDays:[7],url:null,...monitorDbInput({id:monitorId,workspaceId,environmentId,url:origin+'/success'}),nextCheckAt:new Date(0)}})
  const complete=async(status:number)=>{await db.monitor.update({where:{id:monitorId},data:{nextCheckAt:new Date(0)}});const lease=(await claimMonitors('outbox-state',1,2000,db))[0]!;return completeMonitorRun(lease,{status,ping:1,msg:'REQUEST_SECRET_MUST_NOT_PERSIST',code:'CHECK_OK',tlsInfo:{daysRemaining:6,fingerprint:'CERTIFICATE_FINGERPRINT'}} as any,db)}
  assert.equal((await complete(1)).accepted,true);assert.equal((await complete(0)).accepted,true);assert.equal((await complete(0)).accepted,true)
  const rows=await db.notificationOutbox.findMany();assert.equal(rows.length,2);assert.ok(rows.every(row=>row.notificationId===own.id));assert.equal(rows.filter(row=>row.eventType==='tls-expiry').length,1);assert.equal(rows.filter(row=>row.eventType==='status').length,1)
  assert.ok(!JSON.stringify(rows,(_k,v)=>typeof v==='bigint'?String(v):v).includes('REQUEST_SECRET'))
  await db.notificationOutbox.updateMany({where:{eventType:'tls-expiry'},data:{status:'delivered',completedAt:new Date(Date.now()-100*86400000)}})
  const {cleanupRuntime}=await import('../server/services/monitor/cleanup');await cleanupRuntime(db)
  assert.equal(await db.notificationOutbox.count({where:{eventType:'tls-expiry'}}),0);assert.equal(await db.notificationDedupe.count({where:{monitorId}}),1)
  assert.equal((await complete(0)).accepted,true);assert.equal(await db.notificationOutbox.count({where:{eventType:'tls-expiry'}}),0)
  await db.monitor.update({where:{id:monitorId},data:{active:false}});await db.workspace.delete({where:{id:otherWorkspace.id}})
})
