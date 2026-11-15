import {Prisma} from '@prisma/client'
import {workerPrisma} from '../../utils/worker-prisma'
import {positiveSetting} from '../monitor/runtime-config'
/** No delete is eligible until a continuous, transactionally sealed checkpoint covers it. */
export async function retainHistory(db:any=workerPrisma,options:{enabled?:boolean;now?:Date;rawHours?:number;hourlyDays?:number;limit?:number}={}){
 if(!(options.enabled??process.env.HEARTBEAT_RETENTION_ENABLED==='true'))return {rawDeleted:0,hourlyDeleted:0,enabled:false}
 const rawHours=options.rawHours??positiveSetting('HEARTBEAT_RAW_HOURS',48,1,8760),hourlyDays=options.hourlyDays??positiveSetting('HEARTBEAT_HOURLY_DAYS',400,30,3650),limit=Math.min(1000,options.limit||1000)
 return db.$transaction(async(tx:any)=>{
  const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(1420261114,5) AS acquired`;if(!lock.acquired)return {rawDeleted:0,hourlyDeleted:0,enabled:true}
  const now=options.now||(await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now,cutoff=new Date(Math.floor((now.getTime()-rawHours*3600000)/3600000)*3600000)
  // Same lock order as rollup, completion, clear and direct late inserts. Recheck under the monitor lock.
  const monitors:any[]=await tx.$queryRaw`SELECT m.id FROM monitors m JOIN history_checkpoints c ON c.monitor_id=m.id WHERE c.sealed_before>=${cutoff} AND NOT c.clearing AND EXISTS(SELECT 1 FROM heartbeats h WHERE h.monitor_id=m.id AND h.time<${cutoff} OFFSET 1 LIMIT 1) ORDER BY m.id LIMIT 32 FOR UPDATE OF m SKIP LOCKED`
  const locked=monitors.map(row=>row.id)
  const rows:any[]=locked.length?await tx.$queryRaw(Prisma.sql`WITH candidates AS(SELECT h.id,h.monitor_id FROM heartbeats h JOIN history_checkpoints c ON c.monitor_id=h.monitor_id WHERE h.monitor_id IN (${Prisma.join(locked)}) AND h.time<${cutoff} AND c.sealed_before>=${cutoff} AND NOT c.clearing AND h.id<>(SELECT a.id FROM heartbeats a WHERE a.monitor_id=h.monitor_id AND a.time<${cutoff} ORDER BY a.time DESC,a.id DESC LIMIT 1) ORDER BY h.time,h.id LIMIT ${limit} FOR UPDATE OF h SKIP LOCKED),deleted AS(DELETE FROM heartbeats h USING candidates c WHERE h.id=c.id RETURNING h.monitor_id) SELECT monitor_id,count(*)::int AS n FROM deleted GROUP BY monitor_id`):[]
  for(const row of rows)await tx.$executeRaw`UPDATE history_checkpoints SET raw_deleted_before=GREATEST(raw_deleted_before,${cutoff}) WHERE monitor_id=${row.monitor_id}`
  const oldBucket=new Date(now.getTime()-hourlyDays*86400000)
  // Preserve sealed checkpoints; the reader reports unknown coverage outside retained history.
  const hourlyDeleted=await tx.$executeRaw`WITH old AS(SELECT monitor_id,bucket_start FROM heartbeat_hourly WHERE bucket_start<${oldBucket} ORDER BY bucket_start,monitor_id LIMIT ${limit} FOR UPDATE SKIP LOCKED) DELETE FROM heartbeat_hourly h USING old o WHERE h.monitor_id=o.monitor_id AND h.bucket_start=o.bucket_start`
  return {rawDeleted:rows.reduce((sum,row)=>sum+row.n,0),hourlyDeleted:Number(hourlyDeleted),enabled:true}
 },{timeout:10000,maxWait:2000})
}
