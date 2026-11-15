import {Prisma} from '@prisma/client'
import {decodeCursor,encodeCursor} from '../../../utils/pagination'
import {parseBoundedQuery,monitorListQuery,monitorFilter,monitorMetadataSelect,monitorListDTO} from '../../../utils/monitor-query'
export default defineEventHandler(async event=>{
  const scope=await requireRequestSession(event),query=parseBoundedQuery(monitorListQuery,getQuery(event)),secret=useRuntimeConfig().session.password
  const binding={workspaceId:scope.workspaceId,environmentId:scope.environmentId,sort:'id-asc',search:query.search,status:query.status,type:query.type,tagId:query.tagId??null,groupId:query.groupId??null}
  let after=0
  if(query.cursor){try{const position=decodeCursor<{id:number}>(query.cursor,binding,secret);if(!Number.isSafeInteger(position.id)||position.id<1)throw Error();after=position.id}catch{throw createError({statusCode:400,message:'Invalid cursor for this query'})}}
  const ids=await prisma.$queryRaw<{id:number}[]>(Prisma.sql`SELECT m.id FROM monitors m LEFT JOIN monitor_states s ON s.monitor_id=m.id WHERE ${monitorFilter(scope,query)} AND m.id>${after} ORDER BY m.id LIMIT ${query.limit+1}`)
  const hasMore=ids.length>query.limit,selected=ids.slice(0,query.limit).map(row=>row.id)
  const rows=selected.length?await prisma.monitor.findMany({where:{id:{in:selected},workspaceId:scope.workspaceId,environmentId:scope.environmentId},select:monitorMetadataSelect,orderBy:{id:'asc'}}):[]
  return {ok:true,data:rows.map(monitorListDTO),page:{limit:query.limit,hasMore,nextCursor:hasMore?encodeCursor(binding,{id:selected.at(-1)},secret):null}}
})
