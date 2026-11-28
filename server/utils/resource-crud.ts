import type {H3Event} from 'h3'
import {z} from 'zod'
import {prisma} from './prisma'
import {requireWorkspace,assertWorkspaceIds} from './workspace'
import {fenceMonitorIds} from './monitor-mutation'
import {normalizeMaintenance} from './maintenance-input'
import {maintenanceToPublicJSON} from '../services/maintenance/scheduler'
import {enqueueSubscriberNotifications} from '../services/status-page/subscriber-outbox'
import {encodeCursor,decodeCursor} from './pagination'
import {parseBoundedQuery} from './monitor-query'
const listQuery=z.object({limit:z.coerce.number().int().min(1).max(200).default(100),cursor:z.string().max(2048).optional()})
const related={monitors:{select:{monitorId:true,monitor:{select:{id:true,name:true,environmentId:true}}}},statusPages:{select:{statusPageId:true,statusPage:{select:{id:true,title:true}}}}} as const
async function dto(row:any){return {...row,...await maintenanceToPublicJSON(row)}}
export function maintenanceHandler(action:'list'|'get'|'create'|'update'|'delete'|'pause'|'resume'){
 return defineEventHandler(async(event:H3Event)=>{
  const scope=await requireWorkspace(event,['list','get'].includes(action)?'viewer':'editor'),boundEnvironment=event.context.authMethod==='api-key'?event.context.apiKey.environmentId:null
  const environmentWhere=boundEnvironment?{monitors:{every:{monitor:{environmentId:boundEnvironment}}},statusPages:{none:{}}}:{}
  if(action==='list'){
   const query=parseBoundedQuery(listQuery,getQuery(event)),secret=useRuntimeConfig().session.password,binding={resource:'maintenance',workspaceId:scope.workspaceId,environmentId:boundEnvironment||null,sort:'id-asc'};let after=0
   if(query.cursor)try{after=decodeCursor<{id:number}>(query.cursor,binding,secret).id;if(!Number.isSafeInteger(after)||after<1)throw Error()}catch{throw createError({statusCode:400,message:'Invalid maintenance cursor'})}
   const rows=await prisma.maintenance.findMany({where:{workspaceId:scope.workspaceId,...environmentWhere,id:{gt:after}},orderBy:{id:'asc'},take:query.limit+1}),hasMore=rows.length>query.limit,selected=rows.slice(0,query.limit)
   return {ok:true,data:await Promise.all(selected.map(dto)),page:{limit:query.limit,hasMore,nextCursor:hasMore?encodeCursor(binding,{id:selected.at(-1)!.id},secret):null}}
  }
  const id=Number(getRouterParam(event,'id'))
  if(action==='get'){
   const row=Number.isSafeInteger(id)&&id>0?await prisma.maintenance.findFirst({where:{id,workspaceId:scope.workspaceId,...environmentWhere},include:related}):null
   if(!row)throw createError({statusCode:404,message:'Maintenance not found'})
   return {ok:true,data:await dto(row)}
  }
  const body=action==='delete'?null:['pause','resume'].includes(action)?{active:action==='resume'}:await readBody(event)
  let wasActive=false
  const result=await prisma.$transaction(async tx=>{
   let existing:any=null
   if(action!=='create'){
    if(!Number.isSafeInteger(id)||id<1)throw createError({statusCode:404,message:'Maintenance not found'})
    const rows=await tx.$queryRaw`SELECT id FROM maintenances WHERE id=${id} AND workspace_id=${scope.workspaceId} FOR UPDATE`
    if(!(rows as any[]).length)throw createError({statusCode:404,message:'Maintenance not found'})
    existing=await tx.maintenance.findFirst({where:{id,workspaceId:scope.workspaceId,...environmentWhere},include:related});if(!existing)throw createError({statusCode:404,message:'Maintenance not found'})
   }
   wasActive=!!existing?.active
   const oldIds=existing?.monitors.map((row:any)=>row.monitorId)||[]
   if(action==='delete'){await fenceMonitorIds(tx,scope.workspaceId,oldIds);await tx.maintenance.delete({where:{id,workspaceId:scope.workspaceId}});return null}
   let input:ReturnType<typeof normalizeMaintenance>
   try{input=normalizeMaintenance(body,existing)}catch(error){throw createError({statusCode:400,message:(error as Error).message})}
   const monitors=input.monitorIds&&await assertWorkspaceIds(tx,'monitor',input.monitorIds,scope.workspaceId),pages=input.statusPageIds&&await assertWorkspaceIds(tx,'statusPage',input.statusPageIds,scope.workspaceId)
   if(boundEnvironment&&monitors?.length&&await tx.monitor.count({where:{id:{in:monitors},environmentId:boundEnvironment,workspaceId:scope.workspaceId}})!==monitors.length)throw createError({statusCode:404,message:'Related monitor not found'})
   if(boundEnvironment&&pages?.length)throw createError({statusCode:404,message:'Status page relation not available to environment key'})
   await fenceMonitorIds(tx,scope.workspaceId,[...oldIds,...(monitors||[])])
   const maintenance=action==='create'?await tx.maintenance.create({data:{...input.fields,workspaceId:scope.workspaceId,userId:scope.user.id}}):await tx.maintenance.update({where:{id,workspaceId:scope.workspaceId},data:input.fields})
   if(monitors){await tx.maintenanceMonitor.deleteMany({where:{maintenanceId:maintenance.id}});if(monitors.length)await tx.maintenanceMonitor.createMany({data:monitors.map(monitorId=>({maintenanceId:maintenance.id,monitorId}))})}
   if(pages){await tx.maintenanceStatusPage.deleteMany({where:{maintenanceId:maintenance.id}});if(pages.length)await tx.maintenanceStatusPage.createMany({data:pages.map(statusPageId=>({maintenanceId:maintenance.id,statusPageId}))})}
   return tx.maintenance.findUniqueOrThrow({where:{id:maintenance.id},include:related})
  },{timeout:10000,maxWait:2000})
  if(result&&result.statusPages?.length&&wasActive!==!!result.active){
    const event=result.active?'maintenance-started':'maintenance-ended'
    try{
      for(const link of result.statusPages)await enqueueSubscriberNotifications(prisma,link.statusPageId,{event,title:result.title,message:`${event==='maintenance-started'?'Starting':'Ended'} maintenance: ${result.title}`})
    }catch{/* 訂閱通知失敗不影響維護設定 */}
  }
  return result?{ok:true,data:await dto(result)}:{ok:true}
 })
}
