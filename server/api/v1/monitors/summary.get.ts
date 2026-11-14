import {Prisma} from '@prisma/client'
import {monitorStatusSql} from '../../../utils/monitor-query'
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event)
 const rows=await prisma.$queryRaw<{status:string;count:number}[]>(Prisma.sql`SELECT ${monitorStatusSql} AS status,count(*)::int AS count FROM monitors m LEFT JOIN monitor_states s ON s.monitor_id=m.id WHERE m.workspace_id=${scope.workspaceId} AND m.environment_id=${scope.environmentId} GROUP BY 1`)
 const summary={total:0,up:0,down:0,pending:0,unknown:0,maintenance:0,paused:0,stale:0}
 for(const row of rows){(summary as any)[row.status]=row.count;summary.total+=row.count}summary.unknown=summary.pending
 return {ok:true,data:summary}
})
