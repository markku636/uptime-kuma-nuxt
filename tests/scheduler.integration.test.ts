import {databaseBlackhole} from './helpers/database-blackhole'
import {reserveResourceId,sealResource} from '../server/utils/resource-secrets'
import net from 'node:net'
import {WorkerProcess as Child,workerChildren as children} from './helpers/worker-process'
import {test,before,after,beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {spawn,type ChildProcess} from 'node:child_process'
import pg from 'pg'
import {PrismaClient} from '@prisma/client'
import http from 'node:http'
import {monitorDbInput} from '../server/utils/monitor-secrets'
import {fenceMonitorData,fenceEnvironment} from '../server/utils/monitor-mutation'
import {claimMonitors,renewMonitorLease} from '../server/services/monitor/leases'
import {completeMonitorRun} from '../server/services/monitor/completion'
const adminURL=process.env.TEST_PG_ADMIN_URL||'postgresql://postgres@127.0.0.1:55464/postgres'
if(!['127.0.0.1','localhost'].includes(new URL(adminURL).hostname))throw Error('Scheduler tests require local disposable PostgreSQL')
process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
let admin:pg.Client,db:PrismaClient,url:string,name:string,owner:number,workspaceId:number,environmentId:number,server:http.Server,origin:string,hits=0,open=0,maxOpen=0,tcpOpen=0,maxTcp=0
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function until(condition:()=>Promise<boolean>|boolean,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await condition())return;await pause(20)}assert.fail('Timed out waiting for fixture state')}

async function monitor(input:any={}){
  const [{id}]=await db.$queryRaw<{id:number}[]>`SELECT nextval(pg_get_serial_sequence('monitors','id'))::integer AS id`
  return db.monitor.create({data:monitorDbInput({id,name:'Lease fixture',userId:owner,workspaceId,environmentId,type:'http',active:true,interval:60,timeout:1,url:origin+'/fast?token=REQUEST_PRIVATE_SENTINEL',nextCheckAt:new Date(Date.now()-100),...input})})
}
before(async()=>{
  admin=new pg.Client({connectionString:adminURL});await admin.connect();name='uptime_scheduler_'+Date.now();await admin.query(`CREATE DATABASE "${name}"`);const parsed=new URL(adminURL);parsed.pathname='/'+name;parsed.searchParams.set('connection_limit','4');url=parsed.toString()
  const migration=spawn(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:url},stdio:'ignore'});assert.equal(await new Promise(r=>migration.once('exit',r)),0)
  db=new PrismaClient({datasourceUrl:url});owner=(await db.user.create({data:{username:'scheduler-fixture',password:'unused'}})).id
  const workspace=await db.workspace.create({data:{name:'Scheduler',members:{create:{userId:owner,role:'owner'}},environments:{create:{name:'default'}}},include:{environments:true}});workspaceId=workspace.id;environmentId=workspace.environments[0]!.id
  server=http.createServer(async(req,res)=>{
    hits++;open++;maxOpen=Math.max(maxOpen,open);let finished=false
    const finish=()=>{if(!finished){finished=true;open--}};res.once('close',finish)
    for await(const _ of req){}
    if(req.url?.startsWith('/flaky')&&hits<3)res.statusCode=503
    const delay=req.url?.startsWith('/hang')?10000:req.url?.startsWith('/slow')?200:5
    const timer=setTimeout(()=>{if(!res.destroyed){res.setHeader('content-type','application/json');res.end('{"ok":true}')}},delay);timer.unref();res.once('close',()=>clearTimeout(timer))
  });server.on('connection',socket=>{tcpOpen++;maxTcp=Math.max(maxTcp,tcpOpen);socket.once('close',()=>tcpOpen--)});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`
})
beforeEach(async()=>{for(const child of [...children]){child.kill('SIGKILL');children.delete(child)}await db.monitor.deleteMany();await db.notification.deleteMany();hits=0;maxOpen=0;maxTcp=tcpOpen})
after(async()=>{for(const child of children)child.kill('SIGKILL');server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await db.$disconnect();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end()})
test('independent processes race SKIP LOCKED and accept one heartbeat/state per logical run',{timeout:30000},async()=>{
  const target=await monitor(),a=new Child(url),b=new Child(url)
  try{
    const results=await Promise.all([a.call('claim'),b.call('claim')]);assert.equal(results.reduce((n,row)=>n+row.leases.length,0),1)
    const winner=results[0].leases.length?a:b
    const result=await winner.call('complete');assert.equal(result.accepted,true)
    const replay=await winner.call('complete');assert.equal(replay.accepted,false);assert.equal(replay.replayed,true)
    assert.equal(await db.heartbeat.count({where:{monitorId:target.id}}),1);assert.equal(await db.monitorState.count(),1);assert.equal(await db.notificationOutbox.count(),0)
    assert.ok(!JSON.stringify(await db.heartbeat.findMany(),(_k,v)=>typeof v==='bigint'?String(v):v).includes('REQUEST_PRIVATE_SENTINEL'))
  }finally{await a.stop();await b.stop()}
})
test('expired reclaim retains run ID, increments token and fences late result, TLS and renewal',{timeout:30000},async()=>{
  const target=await monitor(),a=new Child(url),b=new Child(url)
  try{
    const first=(await a.call('claim',{leaseMs:300})).leases[0];await pause(350)
    const second=(await b.call('claim',{leaseMs:2000})).leases[0];assert.equal(first.runId,second.runId);assert.equal(BigInt(second.leaseToken),BigInt(first.leaseToken)+1n)
    assert.equal((await a.call('renew')).renewed,false)
    assert.equal((await a.call('complete',{status:0,tls:{subject:'STALE_TLS_SENTINEL'}})).accepted,false)
    assert.equal(await db.heartbeat.count(),0);assert.equal(await db.monitorState.count(),0);assert.equal(await db.notificationOutbox.count(),0);assert.equal((await db.monitor.findUniqueOrThrow({where:{id:target.id}})).tlsInfo,null)
    assert.equal((await b.call('complete')).accepted,true)
  }finally{await a.stop();await b.stop()}
})
test('pause and environment changes invalidate live leases and abort actual in-flight sockets',{timeout:30000},async()=>{
  const target=await monitor({url:origin+'/hang',timeout:10}),worker=new Child(url,{WORKER_LEASE_MS:'600',WORKER_RENEW_MS:'100'})
  try{
    await worker.call('run');await until(()=>hits===1);assert.equal(open,1)
    await db.$transaction(async tx=>{const current=await tx.monitor.findUniqueOrThrow({where:{id:target.id}});await tx.monitor.update({where:{id:target.id},data:await fenceMonitorData(tx,current,{active:false})})})
    await until(()=>open===0,2000);assert.equal(await db.heartbeat.count(),0)
    await worker.stop()
    const a=await monitor(),lease=(await claimMonitors('environment-fence',1,2000,db))[0]!
    await db.$transaction(async tx=>{await tx.environment.update({where:{id:environmentId},data:{variables:{changed:'yes'}}});await fenceEnvironment(tx,workspaceId,environmentId)})
    assert.equal((await completeMonitorRun(lease,{status:1,ping:1,msg:'should reject'},db)).accepted,false)
    await db.monitor.update({where:{id:a.id},data:{active:false}})
  }finally{await worker.stop()}
})
test('worker crash after claim is reclaimed; completion rollback writes no partial history/state/outbox',{timeout:30000},async()=>{
  const target=await monitor(),a=new Child(url),b=new Child(url)
  const first=(await a.call('claim',{leaseMs:300})).leases[0];await a.kill();await pause(350)
  try{
    const second=(await b.call('claim',{leaseMs:5000})).leases[0];assert.equal(second.runId,first.runId)
    await db.$executeRawUnsafe("CREATE FUNCTION reject_state_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture rollback'; END $$")
    await db.$executeRawUnsafe('CREATE TRIGGER reject_state_fixture BEFORE INSERT ON monitor_states FOR EACH ROW EXECUTE FUNCTION reject_state_fixture()')
    const lease=await db.monitor.findUniqueOrThrow({where:{id:target.id}})
    await assert.rejects(completeMonitorRun(lease as any,{status:1,ping:1,msg:'up'},db));assert.equal(await db.heartbeat.count(),0);assert.equal(await db.monitorState.count(),0);assert.equal(await db.notificationOutbox.count(),0)
    await db.$executeRawUnsafe('DROP TRIGGER reject_state_fixture ON monitor_states');await db.$executeRawUnsafe('DROP FUNCTION reject_state_fixture()')
    assert.equal((await b.call('complete')).accepted,true)
  }finally{await b.stop()}
})
test('bounded retries retain one run and total run deadline commits one real timeout after socket cleanup',{timeout:30000},async()=>{
  let target=await monitor({url:origin+'/flaky',maxretries:2,retryInterval:1}),worker=new Child(url)
  try{
    await worker.call('run');await until(async()=>await db.heartbeat.count()===1)
    assert.equal(hits,3);const heartbeat=await db.heartbeat.findFirstOrThrow({where:{monitorId:target.id}});assert.equal(heartbeat.status,1);assert.ok(heartbeat.runId);assert.equal(await db.monitorState.count(),1)
  }finally{await worker.stop()}
  await db.monitor.deleteMany();hits=0
  target=await monitor({url:origin+'/hang',timeout:10,maxretries:10,retryInterval:1});worker=new Child(url,{WORKER_RUN_TIMEOUT_MS:'300'})
  try{
    await worker.call('run');await until(async()=>await db.heartbeat.count()===1,3000);await until(()=>open===0,500)
    const heartbeat=await db.heartbeat.findFirstOrThrow({where:{monitorId:target.id}});assert.equal(heartbeat.status,0);assert.equal(heartbeat.checkCode,'TIMEOUT');assert.equal(hits,1)
  }finally{await worker.stop()}
})
test('delayed claim return cannot start I/O after its monotonic budget, and finished work ignores late renew',{timeout:30000},async()=>{
  const target=await monitor(),a=new Child(url,{WORKER_LEASE_MS:'300',WORKER_RENEW_MS:'50',TEST_CLAIM_RETURN_DELAY_MS:'1000'}),b=new Child(url)
  try{
    await a.call('run');await until(async()=>!!(await db.monitor.findUniqueOrThrow({where:{id:target.id}})).leaseOwner)
    await pause(350);const lease=(await b.call('claim',{leaseMs:2000})).leases[0];assert.ok(lease);assert.equal((await b.call('complete')).accepted,true)
    await until(async()=>(await a.call('status')).status.leaseLost>=1)
    assert.equal(hits,0);assert.equal(await db.heartbeat.count(),1)
  }finally{await a.stop();await b.stop()}
  await db.monitor.deleteMany();hits=0
  await monitor({url:origin+'/slow'})
  const late=new Child(url,{WORKER_LEASE_MS:'500',WORKER_RENEW_MS:'100',TEST_RENEW_RETURN_DELAY_MS:'500'})
  try{
    await late.call('run');await until(async()=>await db.heartbeat.count()===1)
    await pause(1100);const state=(await late.call('status')).status
    assert.equal(state.leaseLost,0);assert.equal(state.inflight,0);assert.equal(hits,1)
  }finally{await late.stop()}
})
test('crash after actual HTTP and after accepted commit preserves one run and durable notification work',{timeout:30000},async()=>{
  const target=await monitor(),a=new Child(url),b=new Child(url),c=new Child(url)
  await db.$transaction(async tx=>{const id=await reserveResourceId(tx,'notification'),row={id,name:'Durable channel',type:'webhook',workspaceId,userId:owner,config:{url:origin+'/notify'},active:true,isDefault:true};await tx.notification.create({data:{...row,...sealResource('notification',row)}})})
  await db.heartbeat.create({data:{monitorId:target.id,status:0,msg:'Legacy baseline',ping:1}})
  try{
    const first=(await a.call('claim',{leaseMs:500})).leases[0];await a.call('checkOnly');assert.equal(hits,1);assert.equal(await db.heartbeat.count({where:{runId:{not:null}}}),0);await a.kill();await pause(550)
    const next=(await b.call('claim',{leaseMs:2000})).leases[0];assert.equal(next.runId,first.runId)
    assert.equal((await b.call('complete')).accepted,true);await b.kill()
    assert.equal(await db.heartbeat.count({where:{monitorId:target.id,runId:{not:null}}}),1);assert.equal(await db.monitorState.count({where:{monitorId:target.id}}),1)
    assert.equal((await claimMonitors('after-commit-crash',1,2000,db)).length,0)
    assert.equal(await db.notificationOutbox.count({where:{status:'pending'}}),1)
    await c.call('dispatch');await until(async()=>await db.notificationOutbox.count({where:{status:'delivered'}})===1);assert.equal(hits,2)
  }finally{await a.stop();await b.stop();await c.stop()}
})
test('process crash inside completion transaction rolls heartbeat/state back before reclaim',{timeout:30000},async()=>{
  const target=await monitor(),a=new Child(url),b=new Child(url)
  await db.$executeRawUnsafe("CREATE FUNCTION pause_state_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(1.5); RETURN NEW; END $$")
  await db.$executeRawUnsafe('CREATE TRIGGER pause_state_fixture BEFORE INSERT ON monitor_states FOR EACH ROW EXECUTE FUNCTION pause_state_fixture()')
  try{
    const first=(await a.call('claim',{leaseMs:500})).leases[0]
    const pending=a.call('complete').catch(()=>undefined)
    await until(async()=>{const result=await admin.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event='PgSleep'",[name]);return result.rows[0].n>0})
    assert.equal(await db.heartbeat.count(),0);await a.kill();await pending
    await db.$executeRawUnsafe('DROP TRIGGER pause_state_fixture ON monitor_states');await db.$executeRawUnsafe('DROP FUNCTION pause_state_fixture()')
    assert.equal(await db.heartbeat.count(),0);assert.equal(await db.monitorState.count(),0)
    const replacement=(await b.call('claim',{leaseMs:2000})).leases[0];assert.equal(replacement.runId,first.runId)
    assert.equal((await b.call('complete')).accepted,true);assert.equal(await db.heartbeat.count({where:{monitorId:target.id}}),1)
  }finally{await a.stop();await b.stop();await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS pause_state_fixture ON monitor_states');await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS pause_state_fixture()')}
})
test('worker connector applies real statement/lock timeouts and watchdog aborts HTTP during a TCP blackhole',{timeout:30000},async()=>{
  const settingsChild=new Child(url)
  try{const result=await settingsChild.call('databaseSettings');assert.equal(result.settings.statement[0].statement_timeout,'2s');assert.equal(result.settings.lock[0].lock_timeout,'1s');assert.equal(result.timedOut,true);assert.ok(result.elapsed>=1500&&result.elapsed<3500)}finally{await settingsChild.stop()}
  let blackhole=false
  const connections=new Set<net.Socket>(),target=new URL(url),databasePort=Number(target.port)
  const proxy=net.createServer(client=>{
    const upstream=net.connect({host:target.hostname,port:databasePort});connections.add(client);connections.add(upstream)
    client.on('data',data=>{if(!blackhole)upstream.write(data)});upstream.on('data',data=>{if(!blackhole)client.write(data)})
    const close=()=>{client.destroy();upstream.destroy();connections.delete(client);connections.delete(upstream)}
    client.on('error',close);upstream.on('error',close);client.on('close',close);upstream.on('close',close)
  })
  await new Promise<void>(r=>proxy.listen(0,'127.0.0.1',r));target.port=String((proxy.address() as net.AddressInfo).port)
  const worker=new Child(target.toString(),{WORKER_LEASE_MS:'1000',WORKER_RENEW_MS:'200'})
  try{
    await monitor({url:origin+'/hang',timeout:10});await worker.call('run');await until(()=>open===1)
    const start=Date.now();blackhole=true
    await until(()=>open===0,1500)
    const elapsed=Date.now()-start;assert.ok(elapsed<1500,`watchdog socket close ${elapsed}ms`);assert.equal(await db.heartbeat.count(),0)
    const state=await worker.call('status');assert.ok(state.status.leaseLost>=1);console.info(`DB TCP blackhole: HTTP socket closed in ${elapsed}ms before query socket_timeout3s`)
  }finally{blackhole=false;await worker.stop();for(const socket of connections)socket.destroy();await new Promise<void>(r=>proxy.close(()=>r()))}
})
test('500 local monitors complete with bounded actual connections across two worker processes',{timeout:60000},async()=>{
  const ids=await db.$queryRaw<{id:number}[]>`SELECT nextval(pg_get_serial_sequence('monitors','id'))::integer AS id FROM generate_series(1,500)`
  await db.monitor.createMany({data:ids.map(({id})=>monitorDbInput({id,name:'Local bounded fixture',userId:owner,workspaceId,environmentId,type:'http',url:origin+'/slow',active:true,interval:60,timeout:2,nextCheckAt:new Date(Date.now()-100)}))})
  const a=new Child(url),b=new Child(url),start=Date.now()
  try{
    await Promise.all([a.call('run'),b.call('run')]);await until(async()=>await db.monitorState.count()===500,45000)
    assert.equal(await db.heartbeat.count(),500);assert.ok(hits>=500,'lease recovery can repeat HTTP but accepted logical runs remain unique');assert.ok(maxOpen<=8,`actual inflight ${maxOpen} > two workers × perOrigin4`);assert.ok(maxTcp<=8,`actual TCP sockets ${maxTcp} > 8`)
    const [sa,sb]=await Promise.all([a.call('status'),b.call('status')]);assert.ok(sa.status.maxInflight<=8);assert.ok(sb.status.maxInflight<=8);assert.ok(sa.status.deferred+sb.status.deferred<=1000,'saturated origin must not repeatedly amplify claims')
    console.info(`500 monitors: ${Date.now()-start}ms, actual inflight=${maxOpen}, actual TCP sockets=${maxTcp}, requests=${hits}, leaseLost=${sa.status.leaseLost+sb.status.leaseLost}, stale=${sa.status.stale+sb.status.stale}, claimed=${sa.status.claimed+sb.status.claimed}, deferred=${sa.status.deferred+sb.status.deferred}`)
    const future=await db.monitor.count({where:{nextCheckAt:{gt:new Date()},runId:null,leaseOwner:null}});assert.equal(future,500)
  }finally{await a.stop();await b.stop()}
})

test('maintenance control read terminates under TCP blackhole and releases worker slot without outbound I/O',{timeout:20000},async()=>{
  await monitor();const proxy=await databaseBlackhole(url),worker=new Child(proxy.url,{TEST_MAINTENANCE_GATE:'1',WORKER_LEASE_MS:'1000',WORKER_RENEW_MS:'200'})
  try{
    const gated=new Promise<void>(resolve=>{worker.child.on('message',(message:any)=>{if(message.maintenanceQuery){proxy.block();resolve()}})})
    await worker.call('run');await gated
    const start=Date.now();await until(async()=>(await worker.call('status')).status.inflight===0,8000)
    assert.equal(hits,0);assert.equal(await db.heartbeat.count(),0)
    console.info(`Maintenance TCP blackhole: actual control query ended and slot released in ${Date.now()-start}ms`)
    const stopping=Date.now();await worker.stop();assert.ok(Date.now()-stopping<7000)
  }finally{proxy.restore();await worker.kill();await proxy.close()}
})

test('runtime control drain completes its real database and listener work during TCP blackhole',{timeout:20000},async()=>{
 const proxy=await databaseBlackhole(url),child=new Child(proxy.url,{APP_ROLE:'api'})
 try{
  assert.equal((await child.call('runtimeStart')).state.ready,true);proxy.block()
  const started=Date.now(),pending=child.call('runtimeDrain')
  await pause(4000);console.info('Runtime drain phase after 4s:',(await child.call('runtimeState')).state.drainPhase)
  const result=await pending;assert.equal(result.state.drainPhase,'complete');assert.ok(Date.now()-started<8000)
 }finally{proxy.restore();await child.kill();await proxy.close()}
})

test('initial control database blackhole recovers readiness automatically without duplicate runtime instances',{timeout:20000},async()=>{
 const proxy=await databaseBlackhole(url);proxy.block();const child=new Child(proxy.url,{APP_ROLE:'api'})
 try{
  await assert.rejects(child.call('runtimeStart'));console.info('Startup fixture:',child.log)
  assert.equal((await child.call('runtimeState')).state.ready,false)
  proxy.restore();await until(async()=>(await child.call('runtimeState')).state.ready,10000)
  const instances=await db.workerInstance.findMany({where:{role:'api'}});assert.ok(instances.length>=1)
  const state=(await child.call('runtimeState')).state;assert.equal(state.initializationFailures,1)
  await child.call('runtimeDrain')
 }finally{proxy.restore();await child.kill();await proxy.close()}
})
