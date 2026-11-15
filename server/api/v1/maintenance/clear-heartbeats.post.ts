import {createClearHistory,clearJobDTO} from '../../../services/uptime/clear-history'
export default defineEventHandler(async event=>{
 const scope=await requireWorkspace(event,'owner'),job=await createClearHistory(scope.workspaceId)
 setResponseStatus(event,202)
 return {ok:true,data:clearJobDTO(job)}
})
