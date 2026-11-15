import {statusConfig} from '../../../utils/public-status'
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event)
 // Configuration lists need page metadata; monitor configuration is never a list projection.
 const pages=await prisma.statusPage.findMany({where:{workspaceId:scope.workspaceId},orderBy:{createdAt:'desc'}})
 return {ok:true,data:pages.map(page=>({...statusConfig(page),createdAt:page.createdAt}))}
})
