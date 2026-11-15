import {Prisma} from '@prisma/client'
import {prisma} from '../../utils/prisma'
export interface UptimeWindow {key:string;start:Date;end:Date}
export interface UptimeRange extends UptimeWindow {monitorId:number}
export interface UptimeResult {
 uptime:number|null;uptimeMs:number;downtimeMs:number;maintenanceMs:number;unknownMs:number;totalMs:number;windowMs:number;coverage:number;
 avgPing:number|null;minPing:number|null;maxPing:number|null;pingSum:number;pingCount:number;upCount:number;downCount:number;totalCount:number;estimated:boolean
}
export function uptimeResult(row:any):UptimeResult {
 const up=Number(row.up_ms||0),down=Number(row.down_ms||0),maintenance=Number(row.maintenance_ms||0),window=Number(row.window_ms||0),pingCount=Number(row.ping_count||0),pingSum=Number(row.ping_sum||0),observed=up+down
 return {uptime:observed?Math.round(up/observed*10000)/100:null,uptimeMs:up,downtimeMs:down,maintenanceMs:maintenance,unknownMs:Math.max(0,window-observed-maintenance),totalMs:observed,windowMs:window,coverage:window?observed/window:0,avgPing:pingCount?Math.round(pingSum/pingCount):null,minPing:row.min_ping===null?null:Number(row.min_ping),maxPing:row.max_ping===null?null:Number(row.max_ping),pingSum,pingCount,upCount:Number(row.up_count||0),downCount:Number(row.down_count||0),totalCount:Number(row.total_count||0),estimated:!!row.estimated}
}
/** SQL returns aggregates only. The start anchor belongs to its preceding state, not the next sample. */
export async function rawUptimeWindows(ids:number[],windows:UptimeWindow[],db:any=prisma):Promise<Map<string,UptimeResult>>{
 if(ids.length>200||windows.length>400)throw Error('Invalid uptime request')
 return rawUptimeRanges(ids.flatMap(monitorId=>windows.map(window=>({...window,monitorId}))),db)
}
export async function rawUptimeRanges(windows:UptimeRange[],db:any=prisma):Promise<Map<string,UptimeResult>>{
 if(!windows.length)return new Map()
 const ids=[...new Set(windows.map(window=>window.monitorId))]
 if(windows.length>80000||ids.length>200||ids.some(id=>!Number.isSafeInteger(id)||id<1))throw Error('Invalid uptime request')
 const start=new Date(Math.min(...windows.map(window=>window.start.getTime()))),end=new Date(Math.max(...windows.map(window=>window.end.getTime())))
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||windows.some(window=>window.end<=window.start||window.end.getTime()-window.start.getTime()>400*86400000))throw Error('Invalid uptime range')
 const rows:any[]=await db.$queryRaw(Prisma.sql`
 WITH selected AS(SELECT unnest(ARRAY[${Prisma.join(ids)}]::int[]) AS id),
 windows(monitor_id,key,start,finish) AS(VALUES ${Prisma.join(windows.map(window=>Prisma.sql`(${window.monitorId}::int,${window.key}::text,${window.start}::timestamptz,${window.end}::timestamptz)`))}),
 bounds AS(SELECT monitor_id,min(start) AS start,max(finish) AS finish FROM windows GROUP BY monitor_id),
 events AS(
  SELECT h.* FROM bounds b CROSS JOIN LATERAL(SELECT id,monitor_id,status,ping,time,coverage_seconds FROM heartbeats WHERE monitor_id=b.monitor_id AND time<b.start ORDER BY time DESC,id DESC LIMIT 1) h
  UNION ALL SELECT h.* FROM bounds b CROSS JOIN LATERAL(SELECT id,monitor_id,status,ping,time,coverage_seconds FROM heartbeats WHERE monitor_id=b.monitor_id AND time>=b.start AND time<b.finish) h
 ), segments AS(
  SELECT *,LEAST(LEAD(time,1,${end}::timestamptz) OVER(PARTITION BY monitor_id ORDER BY time,id),time+make_interval(secs=>COALESCE(coverage_seconds,120))) AS finish FROM events
 ), durations AS(
  SELECT s.monitor_id,w.key,
   COALESCE(sum(EXTRACT(EPOCH FROM LEAST(s.finish,w.finish)-GREATEST(s.time,w.start))*1000) FILTER(WHERE s.status=1),0)::float8 AS up_ms,
   COALESCE(sum(EXTRACT(EPOCH FROM LEAST(s.finish,w.finish)-GREATEST(s.time,w.start))*1000) FILTER(WHERE s.status=0),0)::float8 AS down_ms,
   COALESCE(sum(EXTRACT(EPOCH FROM LEAST(s.finish,w.finish)-GREATEST(s.time,w.start))*1000) FILTER(WHERE s.status=3),0)::float8 AS maintenance_ms,
   bool_or(s.coverage_seconds IS NULL) AS estimated
  FROM segments s JOIN windows w ON w.monitor_id=s.monitor_id AND s.time<w.finish AND s.finish>w.start GROUP BY s.monitor_id,w.key
 ), samples AS(
  SELECT e.monitor_id,w.key,count(*)::int AS total_count,count(*) FILTER(WHERE status=1)::int AS up_count,count(*) FILTER(WHERE status=0)::int AS down_count,
  COALESCE(sum(ping) FILTER(WHERE status=1 AND ping>=0),0)::float8 AS ping_sum,count(*) FILTER(WHERE status=1 AND ping>=0)::int AS ping_count,
  min(ping) FILTER(WHERE status=1 AND ping>=0) AS min_ping,max(ping) FILTER(WHERE status=1 AND ping>=0) AS max_ping
  FROM events e JOIN windows w ON w.monitor_id=e.monitor_id AND e.time>=w.start AND e.time<w.finish GROUP BY e.monitor_id,w.key
 ) SELECT w.monitor_id,w.key,EXTRACT(EPOCH FROM w.finish-w.start)*1000 AS window_ms,d.up_ms,d.down_ms,d.maintenance_ms,d.estimated,s.total_count,s.up_count,s.down_count,s.ping_sum,s.ping_count,s.min_ping,s.max_ping
 FROM windows w LEFT JOIN durations d ON d.monitor_id=w.monitor_id AND d.key=w.key LEFT JOIN samples s ON s.monitor_id=w.monitor_id AND s.key=w.key`)
 return new Map(rows.map(row=>[`${row.monitor_id}:${row.key}`,uptimeResult(row)]))
}
