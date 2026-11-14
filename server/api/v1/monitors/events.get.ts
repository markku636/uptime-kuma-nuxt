import {Prisma} from '@prisma/client'
import {heartbeatSummary} from '../../../utils/serialize'
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event)
 // One indexed top-N per monitor, then a bounded global merge; no historical window scan.
 const rows=await prisma.$queryRaw<any[]>(Prisma.sql`SELECT h.*,m.name AS "monitorName" FROM monitors m CROSS JOIN LATERAL (SELECT id,monitor_id AS "monitorId",status,time,ping,important,duration,check_code AS "checkCode",assertion_results AS "assertionResults" FROM heartbeats WHERE monitor_id=m.id AND important=true ORDER BY time DESC,id DESC LIMIT 25) h WHERE m.workspace_id=${scope.workspaceId} AND m.environment_id=${scope.environmentId} ORDER BY h.time DESC,h.id DESC LIMIT 25`)
 return {ok:true,data:rows.map(row=>({...heartbeatSummary(row),monitorName:row.monitorName}))}
})
