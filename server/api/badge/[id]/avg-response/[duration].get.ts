import {generateBadge,getPingColor} from '../../../../services/badge/generator'
import {calculateUptime} from '../../../../services/uptime/calculator'
import {parseBadgeId,parseBadgeQuery,parseBadgeDuration} from '../../../../utils/badge-input'
export default defineEventHandler(async event=>{
 const id=parseBadgeId(getRouterParam(event,'id'));await assertPublishedMonitor(id)
 const query=parseBadgeQuery(getQuery(event)),hours=parseBadgeDuration(getRouterParam(event,'duration')??'24h'),end=new Date()
 const result=await calculateUptime(id,new Date(end.getTime()-hours*3600000),end),ping=result.avgPing
 const svg=generateBadge({label:query.label??'Avg Response',message:ping===null?'N/A':`${ping}ms`,color:query.color??(ping===null?'#999':getPingColor(ping)),labelColor:query.labelColor,style:query.style})
 setResponseHeader(event,'Content-Type','image/svg+xml');setResponseHeader(event,'Cache-Control','no-cache, no-store, must-revalidate');return svg
})
