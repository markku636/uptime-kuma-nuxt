import {generateBadge} from '../../../services/badge/generator'
import {parseBadgeId,parseBadgeQuery} from '../../../utils/badge-input'
import {cachedCertificateDays} from '../../../utils/tls-cache'
export default defineEventHandler(async event=>{
 const id=parseBadgeId(getRouterParam(event,'id'));await assertPublishedMonitor(id)
 const query=parseBadgeQuery(getQuery(event)),monitor=await prisma.monitor.findUnique({where:{id},select:{tlsInfo:true,configVersion:true,interval:true,timeout:true}})
 if(!monitor)throw createError({statusCode:404,message:'Monitor not found'})
 const days=cachedCertificateDays(monitor.tlsInfo,monitor.configVersion,monitor.interval,monitor.timeout)
 let color=days===null?'#808080':days<0?'#c0392b':days<7?'#e74c3c':days<14?'#e67e22':days<30?'#f1c40f':'#2ecc71'
 const svg=generateBadge({label:query.label??'Cert Exp',message:days===null?'N/A':days<0?'Expired':`${days} days`,color:query.color??color,labelColor:query.labelColor,style:query.style})
 setResponseHeader(event,'Content-Type','image/svg+xml');setResponseHeader(event,'Cache-Control','no-cache, no-store, must-revalidate');return svg
})
