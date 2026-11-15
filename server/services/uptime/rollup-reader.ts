import {Prisma} from '@prisma/client'
import {prisma} from '../../utils/prisma'
import {rawUptimeRanges,uptimeResult,type UptimeWindow,type UptimeResult,type UptimeRange} from './queries'
const hour=3600000,floor=(value:number)=>Math.floor(value/hour)*hour,ceil=(value:number)=>Math.ceil(value/hour)*hour
function add(target:any,value:UptimeResult){target.up_ms+=value.uptimeMs;target.down_ms+=value.downtimeMs;target.maintenance_ms+=value.maintenanceMs;target.ping_sum+=value.pingSum;target.ping_count+=value.pingCount;target.up_count+=value.upCount;target.down_count+=value.downCount;target.total_count+=value.totalCount;target.estimated||=value.estimated;if(value.minPing!==null)target.min_ping=target.min_ping===null?value.minPing:Math.min(target.min_ping,value.minPing);if(value.maxPing!==null)target.max_ping=target.max_ping===null?value.maxPing:Math.max(target.max_ping,value.maxPing)}
async function readWindows(ids:number[],windows:UptimeWindow[],db:any){
 if(!ids.length||!windows.length)return new Map<string,UptimeResult&{precision:string;rangeStart:Date;rangeEnd:Date}>()
 if(ids.length>200||windows.length>400)throw Error('Invalid uptime request')
 const checkpoints=await db.historyCheckpoint.findMany({where:{monitorId:{in:ids},clearing:false}}),byId=new Map<number,any>(checkpoints.map((row:any)=>[row.monitorId,row])),raw:UptimeRange[]=[],sealed:UptimeRange[]=[],accumulators=new Map<string,any>()
 for(const monitorId of ids)for(const window of windows){
  const checkpoint=byId.get(monitorId),requestedStart=window.start.getTime(),requestedEnd=window.end.getTime(),finish=checkpoint?.rawDeletedBefore&&requestedEnd<checkpoint.rawDeletedBefore.getTime()?ceil(requestedEnd):requestedEnd,start=checkpoint?.rawDeletedBefore&&requestedStart<checkpoint.rawDeletedBefore.getTime()?floor(requestedStart):requestedStart
  const value={up_ms:0,down_ms:0,maintenance_ms:0,ping_sum:0,ping_count:0,min_ping:null,max_ping:null,up_count:0,down_count:0,total_count:0,estimated:false,window_ms:finish-start,precision:checkpoint?.rawDeletedBefore&&requestedStart<checkpoint.rawDeletedBefore.getTime()?'hourly':'exact',rangeStart:new Date(start),rangeEnd:new Date(finish)};accumulators.set(`${monitorId}:${window.key}`,value)
  const rollStart=checkpoint?Math.max(ceil(start),checkpoint.firstBucket.getTime()):0,rollEnd=checkpoint?Math.min(floor(finish),checkpoint.sealedBefore.getTime()):0
  if(rollEnd>rollStart){sealed.push({monitorId,key:window.key,start:new Date(rollStart),end:new Date(rollEnd)});if(start<rollStart)raw.push({monitorId,key:window.key+':left',start:new Date(start),end:new Date(rollStart)});if(rollEnd<finish)raw.push({monitorId,key:window.key+':right',start:new Date(rollEnd),end:new Date(finish)})}
  else raw.push({monitorId,key:window.key+':full',start:new Date(start),end:new Date(finish)})
 }
 const rawValues=await rawUptimeRanges(raw,db)
 for(const range of raw){const value=rawValues.get(`${range.monitorId}:${range.key}`)!;add(accumulators.get(`${range.monitorId}:${range.key.replace(/:(left|right|full)$/,'')}`),value)}
 if(sealed.length){
  const rows:any[]=await db.$queryRaw(Prisma.sql`WITH windows(monitor_id,key,start,finish) AS(VALUES ${Prisma.join(sealed.map(window=>Prisma.sql`(${window.monitorId}::int,${window.key}::text,${window.start}::timestamptz,${window.end}::timestamptz)`))}) SELECT w.monitor_id,w.key,sum(h.up_ms)::float8 AS up_ms,sum(h.down_ms)::float8 AS down_ms,sum(h.maintenance_ms)::float8 AS maintenance_ms,sum(h.ping_sum)::float8 AS ping_sum,sum(h.ping_count)::int AS ping_count,min(h.min_ping) AS min_ping,max(h.max_ping) AS max_ping,sum(h.up_count)::int AS up_count,sum(h.down_count)::int AS down_count,sum(h.total_count)::int AS total_count,bool_or(h.estimated) AS estimated FROM windows w JOIN heartbeat_hourly h ON h.monitor_id=w.monitor_id AND h.bucket_start>=w.start AND h.bucket_start<w.finish GROUP BY w.monitor_id,w.key`)
  for(const row of rows)add(accumulators.get(`${row.monitor_id}:${row.key}`),uptimeResult({...row,window_ms:0}))
 }
 return new Map([...accumulators].map(([key,value])=>[key,{...uptimeResult(value),precision:value.precision,rangeStart:value.rangeStart,rangeEnd:value.rangeEnd}]))
}

/** A single snapshot prevents retention/clear from moving data between the raw and sealed reads. */
export async function uptimeWindows(ids:number[],windows:UptimeWindow[],db:any=prisma){
 return db.$transaction((tx:any)=>readWindows(ids,windows,tx),{isolationLevel:"RepeatableRead",timeout:10000,maxWait:2000})
}
