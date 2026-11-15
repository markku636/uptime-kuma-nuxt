import {clearJobDTO} from '../../../../services/uptime/clear-history'
export default defineEventHandler(async event=>{
 const scope=await requireWorkspace(event,'owner'),id=getRouterParam(event,'id')
 if(!id||!/^[a-f0-9-]{36}$/i.test(id))throw createError({statusCode:404,message:'History job not found'})
 const job=await prisma.historyClearJob.findFirst({where:{id,workspaceId:scope.workspaceId}})
 if(!job)throw createError({statusCode:404,message:'History job not found'})
 return {ok:true,data:clearJobDTO(job)}
})
