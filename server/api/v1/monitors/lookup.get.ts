import {parseMonitorIds,scopedMonitorIds,monitorMetadataSelect,monitorListDTO} from '../../../utils/monitor-query'
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event),ids=parseMonitorIds(getQuery(event).ids);await scopedMonitorIds(scope,ids)
 const rows=await prisma.monitor.findMany({where:{workspaceId:scope.workspaceId,environmentId:scope.environmentId,id:{in:ids}},select:monitorMetadataSelect,orderBy:{id:'asc'}})
 return {ok:true,data:rows.map(monitorListDTO)}
})
