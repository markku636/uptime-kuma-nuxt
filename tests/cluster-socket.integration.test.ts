import {databaseBlackhole} from './helpers/database-blackhole'
import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {spawn,type ChildProcess} from 'node:child_process'
import pg from 'pg'
import {PrismaClient} from '@prisma/client'
import bcrypt from 'bcryptjs'
import http from 'node:http'
import {io,type Socket} from 'socket.io-client'
import {monitorDbInput} from '../server/utils/monitor-secrets'
const adminURL=process.env.TEST_PG_ADMIN_URL||'postgresql://postgres@127.0.0.1:55464/postgres'
if(!['127.0.0.1','localhost'].includes(new URL(adminURL).hostname))throw Error('Cluster tests require local disposable PostgreSQL')
process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
let admin:pg.Client,db:PrismaClient,url:string,name:string,owner:number,viewer:number,workspaceId:number,environmentId:number,environmentB:number,monitorId:number,fixture:http.Server,origin:string,hits=0,open=0
const processes:ChildProcess[]=[],logs=new Map<ChildProcess,string>(),sockets:Socket[]=[],eventsA:any[]=[],eventsB:any[]=[],eventsViewer:any[]=[]
const a='http://127.0.0.1:32516',b='http://127.0.0.1:32517',w='http://127.0.0.1:32518',pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function until(condition:()=>Promise<boolean>|boolean,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await condition())return;await pause(25)}assert.fail('Cluster fixture timeout; '+[...logs.values()].join('\n').slice(-4000))}
async function request(base:string,path:string,method='GET',cookie='',body?:any){return fetch(base+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{}),'x-workspace-id':String(workspaceId),'x-environment-id':String(environmentId)},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)})}
async function data(response:Response,status=200){const body=await response.text();assert.equal(response.status,status,body);return JSON.parse(body)}
async function start(role:string,port:number,databaseURL=url){
  const child=spawn(process.execPath,['.output/server/index.mjs'],{env:{...process.env,DATABASE_URL:databaseURL,APP_ROLE:role,NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),NUXT_PUBLIC_APP_URL:`http://127.0.0.1:${port}`,NODE_ENV:'production',NUXT_SESSION_PASSWORD:'cluster-integration-secret-at-least-32-characters',APP_ENCRYPTION_KEY:process.env.APP_ENCRYPTION_KEY,WORKER_CONCURRENCY:'4',WORKER_PER_ORIGIN:'2',WORKER_CLAIM_BATCH:'2',WORKER_POLL_MS:'50',WORKER_LEASE_MS:'1000',WORKER_RENEW_MS:'200',WORKER_DRAIN_MS:'200',LOGIN_RATE_LIMIT:'100',NITRO_SHUTDOWN_TIMEOUT:'10000'},stdio:['ignore','pipe','pipe']})
  processes.push(child);logs.set(child,'');child.stdout!.on('data',chunk=>logs.set(child,logs.get(child)+chunk));child.stderr!.on('data',chunk=>logs.set(child,logs.get(child)+chunk))
  await until(async()=>{try{return(await fetch(`http://127.0.0.1:${port}/api/health/ready`,{signal:AbortSignal.timeout(100)})).ok}catch{return false}},10000)
  return child
}
async function login(base:string,username:string){const response=await request(base,'/api/auth/login','POST','',{username,password:'test-password'});await data(response);return response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')}
async function connect(base:string,cookie:string,events:any[]){
  const {ticket}=await data(await request(base,'/api/auth/socket-ticket','POST',cookie)),socket=io(base,{auth:{ticket},extraHeaders:{Origin:base},transports:['websocket'],reconnection:false,timeout:2000})
  sockets.push(socket);socket.on('heartbeat',event=>events.push(event));await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject)});socket.emit('subscribe_monitors');return socket
}
async function createMonitor(input:any={}){const [{id}]=await db.$queryRaw<{id:number}[]>`SELECT nextval(pg_get_serial_sequence('monitors','id'))::integer AS id`;const monitor=await db.monitor.create({data:monitorDbInput({id,name:'Cross pod monitor',userId:owner,workspaceId,environmentId,type:'http',active:true,interval:60,timeout:2,url:origin+'/?token=CROSS_POD_REQUEST_SECRET',nextCheckAt:new Date(Date.now()-100),...input})});await subscribeCurrent();return monitor}
async function subscribeCurrent(){const ids=(await db.monitor.findMany({where:{workspaceId,environmentId},select:{id:true}})).map(row=>row.id);await Promise.all(sockets.filter(socket=>socket.connected).map(socket=>new Promise<void>(resolve=>socket.timeout(2000).emit('subscribe_monitors',ids,()=>resolve()))))}
let ownerCookie='',viewerCookie='',viewerSocket:Socket,worker:ChildProcess,actualWorkerInstanceId:string
before(async()=>{
  admin=new pg.Client({connectionString:adminURL});await admin.connect();name='uptime_cluster_'+Date.now();await admin.query(`CREATE DATABASE "${name}"`);const parsed=new URL(adminURL);parsed.pathname='/'+name;parsed.searchParams.set('connection_limit','4');url=parsed.toString()
  const migration=spawn(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:url},stdio:'ignore'});assert.equal(await new Promise(r=>migration.once('exit',r)),0)
  db=new PrismaClient({datasourceUrl:url});const password=await bcrypt.hash('test-password',4)
  owner=(await db.user.create({data:{username:'cluster-owner',password,platformAdmin:true}})).id;viewer=(await db.user.create({data:{username:'cluster-viewer',password}})).id
  const workspace=await db.workspace.create({data:{name:'Cross pod',members:{create:[{userId:owner,role:'owner'},{userId:viewer,role:'viewer'}]},environments:{create:[{name:'default'},{name:'other'}]}},include:{environments:true}});workspaceId=workspace.id;environmentId=workspace.environments[0]!.id;environmentB=workspace.environments[1]!.id
  fixture=http.createServer(async(req,res)=>{hits++;open++;res.once('close',()=>open--);for await(const _ of req){};if(req.url?.startsWith('/hang'))return;res.setHeader('content-type','application/json');res.end('{"ok":true,"secret":"CROSS_POD_RESPONSE_SECRET"}')});await new Promise<void>(r=>fixture.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(fixture.address() as any).port}`
  await Promise.all([start('api',32516),start('api',32517)])
  ownerCookie=await login(a,'cluster-owner');viewerCookie=await login(a,'cluster-viewer')
  await connect(a,ownerCookie,eventsA);await connect(b,ownerCookie,eventsB);viewerSocket=await connect(a,viewerCookie,eventsViewer)
})
after(async()=>{
  for(const socket of sockets)socket.disconnect()
  await Promise.all(processes.map(async child=>{if(child.exitCode!==null||child.signalCode)return;child.kill('SIGTERM');await new Promise<void>(resolve=>{const timer=setTimeout(()=>child.kill('SIGKILL'),5000);child.once('exit',()=>{clearTimeout(timer);resolve()})})}))
  fixture.closeAllConnections();await new Promise<void>(r=>fixture.close(()=>r()));await db.$disconnect();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end()
})
test('API-only pods never check; worker-only pod exposes probes and both API sockets receive accepted state',{timeout:30000},async()=>{
  monitorId=(await createMonitor()).id;await pause(300);assert.equal(hits,0);assert.equal(await db.heartbeat.count(),0)
  worker=await start('worker',32518)
  assert.equal((await request(w,'/api/auth/login','POST','',{username:'cluster-owner',password:'test-password'})).status,404);assert.equal((await fetch(w+'/')).status,404);assert.equal((await fetch(w+'/api/health/live')).status,200)
  await until(()=>eventsA.some(event=>event.monitorId===monitorId)&&eventsB.some(event=>event.monitorId===monitorId)&&eventsViewer.some(event=>event.monitorId===monitorId))
  assert.equal(hits,1);assert.equal(await db.heartbeat.count({where:{monitorId}}),1)
  for(const event of [...eventsA,...eventsB,...eventsViewer]){assert.ok(!JSON.stringify(event).includes('CROSS_POD_REQUEST_SECRET'));assert.ok(!JSON.stringify(event).includes('CROSS_POD_RESPONSE_SECRET'));assert.ok(event.revision)}
  const instances=await db.workerInstance.findMany();assert.equal(instances.filter(row=>row.role==='api').length,2);assert.equal(instances.filter(row=>row.role==='worker').length,1);actualWorkerInstanceId=instances.find(row=>row.role==='worker')!.instanceId
})
test('LISTEN disconnect/reconnect resyncs without cross-environment delivery and revoked idle viewer receives no event',{timeout:30000},async()=>{
  // Terminate only listeners inside this disposable database, never another application's sessions.
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND application_name='uptime-state-listener'",[name])
  const previousA=eventsA.length,previousB=eventsB.length,previousViewer=eventsViewer.length
  await data(await request(b,`/api/v1/workspaces/${workspaceId}/members/${viewer}`,'DELETE',ownerCookie))
  await db.monitor.update({where:{id:monitorId},data:{nextCheckAt:new Date(Date.now()-100)}})
  const other=(await createMonitor({environmentId:environmentB})).id
  await until(()=>eventsA.length>previousA&&eventsB.length>previousB&&!viewerSocket.connected)
  assert.equal(eventsViewer.length,previousViewer);assert.ok(!eventsA.some(event=>event.monitorId===other));assert.ok(!eventsB.some(event=>event.monitorId===other))
  await until(async()=>await db.monitorState.count({where:{monitorId:other}})===1)
})
test('push accepted by one API commits shared state and reaches sockets on both APIs',async()=>{
  const push=await createMonitor({type:'push',pushToken:'cluster_push_fixture_token',url:null})
  await data(await request(a,'/api/push/cluster_push_fixture_token?msg=NEVER_PERSIST_PUSH_SECRET'))
  await until(()=>eventsA.some(event=>event.monitorId===push.id)&&eventsB.some(event=>event.monitorId===push.id))
  const beat=await db.heartbeat.findFirstOrThrow({where:{monitorId:push.id}});assert.equal(beat.msg,'Up');assert.equal(beat.checkCode,'PUSH_RECEIVED')
})
test('remote API pause/edit fence worker socket; new configuration resumes and roles report safe diagnostics',{timeout:30000},async()=>{
  const hang=await createMonitor({url:origin+'/hang',timeout:10});await until(()=>open===1)
  await data(await request(a,`/api/v1/monitors/${hang.id}/pause`,'POST',ownerCookie))
  await until(()=>open===0,2000);assert.equal(await db.heartbeat.count({where:{monitorId:hang.id}}),0)
  await data(await request(b,`/api/v1/monitors/${hang.id}`,'PUT',ownerCookie,{url:origin+'/new?token=NEW_REQUEST_SECRET',active:true}))
  await db.monitor.update({where:{id:hang.id},data:{nextCheckAt:new Date(Date.now()-100)}})
  await until(()=>eventsA.some(event=>event.monitorId===hang.id)&&eventsB.some(event=>event.monitorId===hang.id))
  assert.equal(await db.heartbeat.count({where:{monitorId:hang.id}}),1)
  const offlineId=crypto.randomUUID();await db.workerInstance.create({data:{instanceId:offlineId,role:'worker',lastSeen:new Date(Date.now()-60000),concurrency:999,metrics:{}}})
  const diagnostics=await data(await request(a,'/api/v1/nodes/runtime','GET',ownerCookie));assert.equal(diagnostics.data.role,'api');assert.equal(diagnostics.data.local.worker,undefined);const offline=diagnostics.data.instances.find((row:any)=>row.instanceId===offlineId);assert.equal(offline.state,'offline');assert.equal(offline.effectiveConcurrency,0)
  assert.ok(!JSON.stringify(diagnostics).includes('NEW_REQUEST_SECRET'));assert.ok(!JSON.stringify(diagnostics).includes('postgresql:'))
  await data(await request(b,`/api/v1/workspaces/${workspaceId}/members`,'POST',ownerCookie,{username:'cluster-viewer',role:'viewer'}))
  assert.equal((await request(a,'/api/v1/nodes/runtime','GET',viewerCookie)).status,403)
  worker.kill('SIGTERM');await until(()=>worker.exitCode!==null||worker.signalCode!==null,5000)
  const instance=await db.workerInstance.findUnique({where:{instanceId:actualWorkerInstanceId}});assert.equal(instance?.draining,true)
})

test('API readiness and runtime registry drain remain bounded during a real TCP database blackhole',{timeout:25000},async()=>{
  const proxy=await databaseBlackhole(url);let child:ChildProcess|undefined
  try{
    child=await start('api',32519,proxy.url);proxy.block()
    const started=Date.now(),response=await fetch('http://127.0.0.1:32519/api/health/ready',{headers:{connection:'close'},signal:AbortSignal.timeout(7000)})
    assert.equal(response.status,503);await response.text();assert.ok(Date.now()-started<6500)
    const live=await fetch('http://127.0.0.1:32519/api/health/live',{headers:{connection:'close'},signal:AbortSignal.timeout(1000)});assert.equal(live.status,200);await live.text()
    const draining=Date.now();child.kill('SIGTERM');await until(()=>logs.get(child!)!.includes('[Runtime] Drained'),7000);const runtimeDrainMs=Date.now()-draining
    await until(()=>child!.exitCode!==null||child!.signalCode!==null,15000)
    assert.ok(runtimeDrainMs<7000);assert.ok(!logs.get(child)!.includes('Graceful shutdown timeout'))
    console.info(`Blackhole readiness=${Date.now()-started}ms including actual runtime drain=${runtimeDrainMs}ms and HTTP/process drain=${Date.now()-draining}ms`)
  }finally{proxy.restore();if(child&&child.exitCode===null&&!child.signalCode)child.kill('SIGKILL');await proxy.close()}
})
