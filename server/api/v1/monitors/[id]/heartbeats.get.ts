import {z} from 'zod'
import {heartbeatSummary} from '../../../../utils/serialize'
import {decodeCursor,encodeCursor} from '../../../../utils/pagination'
const schema=z.object({limit:z.coerce.number().int().min(1).max(200).default(50),cursor:z.string().max(2048).optional(),offset:z.coerce.number().int().min(0).max(1000).default(0),from:z.iso.datetime().optional(),to:z.iso.datetime().optional()}).strict()
const positionSchema=z.object({time:z.iso.datetime(),id:z.string().regex(/^[1-9]\d{0,19}$/),upperTime:z.iso.datetime(),upperId:z.string().regex(/^[1-9]\d{0,19}$/)})
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event),id=z.coerce.number().int().positive().parse(getRouterParam(event,'id')),query=schema.parse(getQuery(event))
 if(query.cursor&&query.offset)throw createError({statusCode:400,message:'Cursor and offset cannot be combined'})
 if(!await prisma.monitor.findFirst({where:{id,workspaceId:scope.workspaceId,environmentId:scope.environmentId},select:{id:true}}))throw createError({statusCode:404,message:'Monitor not found'})
 const binding={workspaceId:scope.workspaceId,environmentId:scope.environmentId,monitorId:id,sort:'time-id-desc',from:query.from??null,to:query.to??null},secret=useRuntimeConfig().session.password
 let position:z.infer<typeof positionSchema>|undefined
 if(query.cursor)try{position=positionSchema.parse(decodeCursor(query.cursor,binding,secret))}catch{throw createError({statusCode:400,message:'Invalid history cursor'})}
 const conditions:any[]=[{monitorId:id}]
 if(query.from||query.to)conditions.push({time:{...(query.from?{gte:new Date(query.from)}:{}),...(query.to?{lt:new Date(query.to)}:{})}})
 if(position){conditions.push({OR:[{time:{lt:new Date(position.time)}},{time:new Date(position.time),id:{lt:BigInt(position.id)}}]});conditions.push({OR:[{time:{lt:new Date(position.upperTime)}},{time:new Date(position.upperTime),id:{lte:BigInt(position.upperId)}}]})}
 const rows=await prisma.heartbeat.findMany({where:{AND:conditions},orderBy:[{time:'desc'},{id:'desc'}],take:query.limit+1,skip:query.offset})
 const hasMore=rows.length>query.limit,selected=rows.slice(0,query.limit),last=selected.at(-1),upper=selected[0]
 return {ok:true,data:selected.map(heartbeatSummary),limit:query.limit,offset:query.offset,...(query.offset?{deprecated:'Offset is limited to 1000; use page.nextCursor'}:{}),page:{hasMore,nextCursor:hasMore&&last&&upper?encodeCursor(binding,{time:last.time.toISOString(),id:String(last.id),upperTime:position?.upperTime??upper.time.toISOString(),upperId:position?.upperId??String(upper.id)},secret):null}}
})
