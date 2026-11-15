import {Prisma} from '@prisma/client'
import {workerPrisma} from '../../utils/worker-prisma'
import {rawUptimeRanges,type UptimeRange} from './queries'
const hour=3600000
/** Seal finite, complete UTC hours; monitor locks serialize completion, clear and late invalidation. */
export async function rollupBatch(db:any=workerPrisma,options:{now?:Date;limit?:number;hours?:number}={}){
 const limit=Math.min(32,Math.max(1,options.limit||32)),hours=Math.min(24,Math.max(1,options.hours||24))
 return db.$transaction(async(tx:any)=>{
  const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(1420261114,5) AS acquired`;if(!lock.acquired)return {monitors:0,buckets:0}
  const now=options.now||(await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now,target=new Date(Math.floor((now.getTime()-300000)/hour)*hour)
  const locked:any[]=await tx.$queryRaw(Prisma.sql`SELECT m.id FROM monitors m LEFT JOIN history_checkpoints c ON c.monitor_id=m.id LEFT JOIN LATERAL(SELECT time FROM heartbeats WHERE monitor_id=m.id ORDER BY time,id LIMIT 1) h ON true WHERE c.clearing IS NOT TRUE AND (m.lease_until IS NULL OR m.lease_until<statement_timestamp()) AND COALESCE(c.sealed_before,date_trunc('hour',h.time,'UTC'))<${target} ORDER BY m.id LIMIT ${limit} FOR UPDATE OF m SKIP LOCKED`)
  if(!locked.length)return {monitors:0,buckets:0}
  // A fresh statement after row locks observes any invalidation committed while locking.
  const monitors:any[]=await tx.$queryRaw(Prisma.sql`SELECT m.id,m.workspace_id,m.environment_id,c.first_bucket,c.sealed_before,c.generation,h.time AS first_time FROM monitors m LEFT JOIN history_checkpoints c ON c.monitor_id=m.id LEFT JOIN LATERAL(SELECT time FROM heartbeats WHERE monitor_id=m.id ORDER BY time,id LIMIT 1) h ON true WHERE m.id IN (${Prisma.join(locked.map(row=>row.id))}) AND c.clearing IS NOT TRUE AND COALESCE(c.sealed_before,date_trunc('hour',h.time,'UTC'))<${target}`)
  const ranges:UptimeRange[]=[],plans=new Map<number,{first:Date;start:Date;end:Date;generation:bigint}>()
  for(const monitor of monitors){const first=monitor.first_bucket||new Date(Math.floor(monitor.first_time.getTime()/hour)*hour),start=monitor.sealed_before||first,end=new Date(Math.min(target.getTime(),start.getTime()+hours*hour));plans.set(monitor.id,{first,start,end,generation:monitor.generation||1n});for(let time=start.getTime();time<end.getTime();time+=hour)ranges.push({monitorId:monitor.id,key:String(time),start:new Date(time),end:new Date(time+hour)})}
  const values=await rawUptimeRanges(ranges,tx),data:any[]=[]
  for(const range of ranges){const value=values.get(`${range.monitorId}:${range.key}`)!,monitor=monitors.find(row=>row.id===range.monitorId)!,plan=plans.get(range.monitorId)!;data.push({monitorId:range.monitorId,workspaceId:monitor.workspace_id,environmentId:monitor.environment_id,bucketStart:range.start,upMs:BigInt(Math.round(value.uptimeMs)),downMs:BigInt(Math.round(value.downtimeMs)),maintenanceMs:BigInt(Math.round(value.maintenanceMs)),unknownMs:BigInt(Math.round(value.unknownMs)),pingSum:BigInt(value.pingSum),pingCount:value.pingCount,minPing:value.minPing,maxPing:value.maxPing,upCount:value.upCount,downCount:value.downCount,totalCount:value.totalCount,estimated:value.estimated,generation:plan.generation})}
  for(const monitor of monitors){const plan=plans.get(monitor.id)!;await tx.heartbeatHourly.deleteMany({where:{monitorId:monitor.id,bucketStart:{gte:plan.start,lt:plan.end}}})}
  if(data.length)await tx.heartbeatHourly.createMany({data})
  for(const monitor of monitors){const plan=plans.get(monitor.id)!;await tx.historyCheckpoint.upsert({where:{monitorId:monitor.id},create:{monitorId:monitor.id,workspaceId:monitor.workspace_id,environmentId:monitor.environment_id,firstBucket:plan.first,sealedBefore:plan.end,generation:plan.generation},update:{sealedBefore:plan.end}})}
  return {monitors:monitors.length,buckets:data.length}
 },{timeout:10000,maxWait:2000})
}
