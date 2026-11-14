import {z} from 'zod'
import {parseMonitorIds,scopedMonitorIds,recentHeartbeats} from '../../../utils/monitor-query'
import {heartbeatSummary} from '../../../utils/serialize'
export default defineEventHandler(async event=>{
 const scope=await requireRequestSession(event),query=z.object({ids:z.string(),limit:z.coerce.number().int().min(1).max(50).default(20)}).strict().parse(getQuery(event)),ids=parseMonitorIds(query.ids)
 await scopedMonitorIds(scope,ids)
 const beats=await recentHeartbeats(ids,query.limit),data:Record<number,ReturnType<typeof heartbeatSummary>[]>={}
 for(const id of ids)data[id]=[]
 for(const beat of beats)data[beat.monitorId]!.push(heartbeatSummary(beat))
 return {ok:true,data}
})
