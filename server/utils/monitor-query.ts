import {Prisma} from '@prisma/client'
import {z} from 'zod'
import {prisma} from './prisma'
import {monitorSummary,heartbeatSummary} from './serialize'
export const monitorListQuery=z.object({limit:z.coerce.number().int().min(1).max(200).default(100),cursor:z.string().max(2048).optional(),search:z.string().trim().max(200).default(''),status:z.enum(['all','up','down','pending','unknown','maintenance','paused','stale']).default('all'),type:z.string().max(40).regex(/^[a-z-]*$/).default(''),tagId:z.coerce.number().int().positive().optional(),groupId:z.union([z.literal('none'),z.coerce.number().int().positive()]).optional()}).strict()
export const monitorMetadataSelect={id:true,workspaceId:true,environmentId:true,name:true,description:true,type:true,active:true,interval:true,retryInterval:true,timeout:true,maxretries:true,weight:true,createdAt:true,parent:true,groupId:true,tags:{include:{tag:true}},states:{take:1}} satisfies Prisma.MonitorSelect
export const monitorStatusSql=Prisma.sql`CASE WHEN NOT m.active THEN 'paused' WHEN s.monitor_id IS NULL THEN 'pending' WHEN s.checked_at + make_interval(secs=>GREATEST(m.interval*2,m.interval+m.timeout)) < statement_timestamp() THEN 'stale' WHEN s.status=1 THEN 'up' WHEN s.status=0 THEN 'down' WHEN s.status=3 THEN 'maintenance' ELSE 'pending' END`
export function monitorFilter(scope:{workspaceId:number;environmentId:number},query:z.infer<typeof monitorListQuery>){
  const conditions=[Prisma.sql`m.workspace_id=${scope.workspaceId}`,Prisma.sql`m.environment_id=${scope.environmentId}`]
  if(query.search)conditions.push(Prisma.sql`strpos(lower(m.name),lower(${query.search}))>0`)
  if(query.type&&query.type!=='all')conditions.push(Prisma.sql`m.type=${query.type}`)
  if(query.status!=='all')conditions.push(Prisma.sql`${monitorStatusSql}=${query.status==='unknown'?'pending':query.status}`)
  if(query.tagId)conditions.push(Prisma.sql`EXISTS(SELECT 1 FROM monitor_tags mt WHERE mt.monitor_id=m.id AND mt.tag_id=${query.tagId})`)
  if(query.groupId==='none')conditions.push(Prisma.sql`m.group_id IS NULL`)
  else if(query.groupId)conditions.push(Prisma.sql`m.group_id=${query.groupId}`)
  return Prisma.join(conditions,' AND ')
}
export function stateDTO(state:any){return state?{monitorId:state.monitorId,heartbeatId:state.heartbeatId===null?null:String(state.heartbeatId),revision:String(state.revision),status:state.status,ping:state.ping,checkCode:state.checkCode,checkedAt:state.checkedAt,statusChangedAt:state.statusChangedAt,assertionResults:state.assertionResults??null}:null}
export function stateHeartbeat(state:any){return heartbeatSummary({id:state.heartbeatId??'0',monitorId:state.monitorId,status:state.status,time:state.checkedAt,ping:state.ping,checkCode:state.checkCode,assertionResults:state.assertionResults??null,important:false,duration:0})}
export function monitorListDTO(monitor:any){
  const state=monitor.states?.[0],viewStatus=!monitor.active?'paused':!state?'pending':state.checkedAt.getTime()+Math.max(monitor.interval*2,monitor.interval+monitor.timeout)*1000<Date.now()?'stale':({0:'down',1:'up',3:'maintenance'} as any)[state.status]||'pending'
  return {...monitorSummary(monitor),state:stateDTO(state),viewStatus,heartbeats:state?[stateHeartbeat(state)]:[]}
}
export function parseMonitorIds(input:unknown){
  const result=parseBoundedQuery(z.string().min(1).max(2400).regex(/^\d+(,\d+)*$/),input).split(',').map(Number),ids=[...new Set(result)]
  if(result.length>200||ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw createError({statusCode:400,message:'Supply at most 200 monitor IDs'})
  return ids
}
export async function scopedMonitorIds(scope:{workspaceId:number;environmentId:number},ids:number[],db=prisma){
  const rows=await db.monitor.findMany({where:{workspaceId:scope.workspaceId,environmentId:scope.environmentId,id:{in:ids}},select:{id:true}})
  if(rows.length!==ids.length)throw createError({statusCode:404,message:'Monitor not found'})
  return rows
}
export async function recentHeartbeats(ids:number[],limit=20,db=prisma){
  if(!ids.length)return []
  return db.$queryRaw<any[]>(Prisma.sql`SELECT h.* FROM unnest(ARRAY[${Prisma.join(ids)}]::int[]) AS selected(id) CROSS JOIN LATERAL (SELECT id,monitor_id AS "monitorId",status,time,ping,important,duration,check_code AS "checkCode",assertion_results AS "assertionResults" FROM heartbeats WHERE monitor_id=selected.id ORDER BY time DESC,id DESC LIMIT ${limit}) h ORDER BY h."monitorId",h.time DESC,h.id DESC`)
}

export function parseBoundedQuery<T>(schema:z.ZodType<T>,input:unknown):T{const result=schema.safeParse(input);if(!result.success)throw createError({statusCode:400,message:'Invalid query parameters'});return result.data}
