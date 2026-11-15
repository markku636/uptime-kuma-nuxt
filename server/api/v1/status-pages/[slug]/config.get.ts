import {statusConfig} from '../../../../utils/public-status'
export default defineEventHandler(async event=>{
 const scope=await requireWorkspace(event,'editor'),slug=getRouterParam(event,'slug')
 const page=await prisma.statusPage.findFirst({where:{slug,workspaceId:scope.workspaceId}})
 if(!page)throw createError({statusCode:404,message:'Status page not found'})
 const [groups,links]=await Promise.all([prisma.statusPageGroup.findMany({where:{statusPageId:page.id},orderBy:[{weight:'asc'},{id:'asc'}],take:101}),prisma.statusPageMonitor.findMany({where:{group:{statusPageId:page.id},monitor:{workspaceId:scope.workspaceId}},select:{groupId:true,monitor:{select:{id:true,name:true}}},take:4001})])
 if(groups.length>100||links.length>4000)throw createError({statusCode:413,message:'Status page configuration limit exceeded'})
 return {ok:true,data:{...statusConfig(page),publicGroupList:groups.map(group=>({id:group.id,name:group.name,weight:group.weight,monitorList:links.filter(link=>link.groupId===group.id).map(link=>link.monitor)}))}}
})
