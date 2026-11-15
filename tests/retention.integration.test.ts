import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import {PrismaClient} from '@prisma/client'
import {user,workspace,cleanup,prisma,type Identity,type Scope} from './helpers/http'
import {rawUptimeWindows} from '../server/services/uptime/queries'
import {uptimeWindows} from '../server/services/uptime/rollup-reader'
import {rollupBatch} from '../server/services/uptime/rollup'
import {retainHistory} from '../server/services/uptime/retention'
import {createClearHistory,processClearHistory} from '../server/services/uptime/clear-history'
let owner:Identity,scope:Scope,monitorId:number
const start=new Date('2026-01-01T00:00:00Z'),at=(hours:number)=>new Date(start.getTime()+hours*3600000)
before(async()=>{owner=await user('retention');scope=await workspace(owner,'History validation');monitorId=(await prisma.monitor.create({data:{userId:owner.id,...scope,name:'Rollup',type:'http',active:false}})).id;await prisma.heartbeat.createMany({data:Array.from({length:241},(_,n)=>({monitorId,time:new Date(start.getTime()+n*60000),status:n%10===0?0:n%7===0?3:1,ping:n%3,coverageSeconds:120}))})})
after(async()=>{await prisma.historyClearJob.deleteMany({where:{workspaceId:scope.workspaceId}});await cleanup([owner],[scope])})
test('hourly sums equal raw across partial edges; retention keeps an anchor and cannot delete unsealed data',async()=>{
 const window={key:'range',start:new Date(start.getTime()+12345),end:new Date(at(4).getTime()-23456)}
 const raw=(await rawUptimeWindows([monitorId],[window],prisma)).get(`${monitorId}:range`)!
 assert.equal((await retainHistory(prisma,{now:at(8)})).enabled,false)
 assert.equal((await retainHistory(prisma,{enabled:true,now:at(8),rawHours:4})).rawDeleted,0)
 assert.equal((await rollupBatch(prisma,{now:at(6)})).buckets,5)
 const rolled=(await uptimeWindows([monitorId],[window],prisma)).get(`${monitorId}:range`)!
 for(const key of ['uptimeMs','downtimeMs','maintenanceMs','pingSum','pingCount','totalCount'] as const)assert.equal(rolled[key],raw[key],key)
 assert.equal((await retainHistory(prisma,{enabled:true,now:at(8),rawHours:4})).rawDeleted,239)
 assert.equal(await prisma.heartbeat.count({where:{monitorId,time:{lt:at(4)}}}),1)
 const full={key:'full',start,end:at(4)},before=(await uptimeWindows([monitorId],[full],prisma)).get(`${monitorId}:full`)!
 assert.equal(before.windowMs,4*3600000);assert.equal(before.totalCount,240);assert.equal(before.precision,'hourly')
 await assert.rejects(prisma.heartbeat.create({data:{monitorId,time:at(2),status:1}}),/Late heartbeat/)
 await retainHistory(prisma,{enabled:true,now:at(8),rawHours:6});assert.equal((await prisma.historyCheckpoint.findUniqueOrThrow({where:{monitorId}})).rawDeletedBefore!.getTime(),at(4).getTime())
})
test('late insert serializes against first/existing seal and invalidates only retained hours',async()=>{
 const db2=new PrismaClient()
 try{for(const first of [true,false]){
  const id=(await prisma.monitor.create({data:{userId:owner.id,...scope,name:'Late '+first,type:'http',active:false}})).id
  if(!first)await prisma.historyCheckpoint.create({data:{monitorId:id,...scope,firstBucket:start,sealedBefore:at(1)}})
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),locked=new Promise<void>(r=>entered=r)
  const seal=prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM monitors WHERE id=${id} FOR UPDATE`;entered();await gate;await tx.historyCheckpoint.upsert({where:{monitorId:id},create:{monitorId:id,...scope,firstBucket:start,sealedBefore:at(2)},update:{sealedBefore:at(2)}})},{timeout:5000})
  await locked;let done=false;const insert=db2.heartbeat.create({data:{monitorId:id,time:at(1.5),status:1}}).then(()=>{done=true});await new Promise(r=>setTimeout(r,60));assert.equal(done,false);release();await Promise.all([seal,insert]);const checkpoint=await prisma.historyCheckpoint.findUniqueOrThrow({where:{monitorId:id}});assert.equal(checkpoint.sealedBefore.getTime(),at(1).getTime());assert.equal(checkpoint.generation,2n)
 }}finally{await db2.$disconnect()}
})
test('clear runs in bounded chunks, retains new observations/current-state and keeps other workspace data',async()=>{
 const current=await prisma.heartbeat.create({data:{monitorId,time:new Date(),status:1,ping:0}})
 await prisma.monitorState.create({data:{monitorId,...scope,heartbeatId:current.id,checkCode:"CHECK_OK",status:1,ping:0,checkedAt:current.time,statusChangedAt:current.time}})
 const job=await createClearHistory(scope.workspaceId,prisma)
 const fresh=await prisma.heartbeat.create({data:{monitorId,time:new Date(job.cutoff.getTime()+1),status:0,ping:0}})
 for(let i=0;i<15;i++){await processClearHistory(prisma);if((await prisma.historyClearJob.findUniqueOrThrow({where:{id:job.id}})).status==='completed')break}
 const done=await prisma.historyClearJob.findUniqueOrThrow({where:{id:job.id}});assert.equal(done.status,'completed');assert.ok(done.deletedRows>0n)
 assert.equal(await prisma.heartbeat.count({where:{monitorId}}),1);assert.equal((await prisma.heartbeat.findFirstOrThrow({where:{monitorId}})).id,fresh.id)
 assert.equal((await prisma.monitorState.findUniqueOrThrow({where:{monitorId}})).heartbeatId,current.id)
 assert.equal(await prisma.heartbeatHourly.count({where:{monitorId}}),0)
})

test('one repeatable snapshot survives a concurrent seal and raw retention between reader queries',async()=>{
 const id=(await prisma.monitor.create({data:{userId:owner.id,...scope,name:'Snapshot',type:'http',active:false}})).id
 await prisma.heartbeat.createMany({data:Array.from({length:121},(_,n)=>({monitorId:id,time:new Date(start.getTime()+n*60000),status:1,ping:0,coverageSeconds:120}))})
 await rollupBatch(prisma,{now:at(1.1)})
 const second=new PrismaClient();let entered!:()=>void,release!:()=>void;const gated=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r)
 const wrapped={$transaction:(callback:any,options:any)=>prisma.$transaction(async tx=>callback(new Proxy(tx,{get(target,key){if(key==='historyCheckpoint')return {findMany:async(input:any)=>{const rows=await tx.historyCheckpoint.findMany(input);entered();await gate;return rows}};const value=(target as any)[key];return typeof value==='function'?value.bind(target):value}})),options)}
 try{const reading=uptimeWindows([id],[{key:'all',start,end:at(2)}],wrapped);await gated;await rollupBatch(second,{now:at(3)});await retainHistory(second,{enabled:true,now:at(4),rawHours:2});release();const result=(await reading).get(`${id}:all`)!;assert.equal(result.uptimeMs,7200000);assert.equal(result.pingCount,120)}finally{release();await second.$disconnect()}
})
