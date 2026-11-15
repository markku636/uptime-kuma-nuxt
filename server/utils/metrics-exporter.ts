import {Prisma} from '@prisma/client'
import {workerPrisma} from './worker-prisma'
import {monitorStatusSql} from './monitor-query'
/** Fixed-dimensional current-state metrics; no raw heartbeat scan, URL labels or N+1 queries. */
export async function exportMetrics(scope?:{workspaceId:number;environmentId:number}){
 const rows:any[]=await workerPrisma.$queryRaw(Prisma.sql`SELECT ${monitorStatusSql} AS status,count(*)::int AS monitors,count(s.ping) FILTER(WHERE s.status=1)::int AS ping_count,COALESCE(sum(s.ping) FILTER(WHERE s.status=1),0)::float8 AS ping_sum FROM monitors m LEFT JOIN monitor_states s ON s.monitor_id=m.id ${scope?Prisma.sql`WHERE m.workspace_id=${scope.workspaceId} AND m.environment_id=${scope.environmentId}`:Prisma.empty} GROUP BY 1`)
 const lines=['# HELP uptime_kuma_monitors Current monitor count by operational status.','# TYPE uptime_kuma_monitors gauge','# HELP uptime_kuma_current_ping_sum Milliseconds across current UP observations.','# TYPE uptime_kuma_current_ping_sum gauge','# HELP uptime_kuma_current_ping_count Current UP observations including valid zero-ms responses.','# TYPE uptime_kuma_current_ping_count gauge']
 for(const status of ['up','down','pending','unknown','maintenance','paused','stale']){const row=rows.find(row=>row.status===status);lines.push(`uptime_kuma_monitors{status="${status}"} ${row?.monitors||0}`)}
 lines.push(`uptime_kuma_current_ping_sum ${rows.filter(row=>row.status==='up').reduce((sum,row)=>sum+Number(row.ping_sum),0)}`,`uptime_kuma_current_ping_count ${rows.filter(row=>row.status==='up').reduce((sum,row)=>sum+Number(row.ping_count),0)}`)
 return lines.join('\n')+'\n'
}
