import {parseMonitorIds,scopedMonitorIds,stateDTO} from '../../../utils/monitor-query'
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event),ids=parseMonitorIds(getQuery(event).ids);await scopedMonitorIds(scope,ids)
 const rows=await prisma.monitorState.findMany({where:{workspaceId:scope.workspaceId,environmentId:scope.environmentId,monitorId:{in:ids}},orderBy:{monitorId:'asc'}})
 return {ok:true,data:rows.map(stateDTO)}
})
