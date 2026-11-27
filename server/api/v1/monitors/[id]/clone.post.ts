import {withoutMonitorLease,databaseNow,initialMonitorSchedule} from '../../../../utils/monitor-mutation'
import { nanoid } from 'nanoid'
import { hydrateMonitor, monitorEditorDTO, reserveMonitorId, monitorDbInput } from '../../../../utils/monitor-secrets'

export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor'), id=Number(getRouterParam(event,'id'))
  const result=await prisma.$transaction(async tx=>{
    const original=await tx.monitor.findFirst({where:{id,workspaceId:scope.workspaceId,environmentId:scope.environmentId},include:{tags:true,monitorNotifications:true}})
    if(!original)throw createError({statusCode:404,message:'Monitor not found'})
    const {id:_id,createdAt,tags,monitorNotifications,requestSecrets,...data}=withoutMonitorLease(hydrateMonitor(original))
    const newId=await reserveMonitorId(tx)
    const input={...data,...initialMonitorSchedule(newId,data.interval,await databaseNow(tx)),configVersion:1,id:newId,name:`${original.name} (Copy)`,active:false,userId:scope.user.id,pushToken:original.type==='push'?nanoid(32):null}
    const monitor=await tx.monitor.create({data:monitorDbInput(input)})
    if(tags.length)await tx.monitorTag.createMany({data:tags.map((row:any)=>({monitorId:monitor.id,tagId:row.tagId,value:row.value}))})
    if(monitorNotifications.length)await tx.monitorNotification.createMany({data:monitorNotifications.map((row:any)=>({monitorId:monitor.id,notificationId:row.notificationId,delayMinutes:row.delayMinutes||0}))})
    return tx.monitor.findUniqueOrThrow({where:{id:monitor.id},include:{tags:{include:{tag:true}},monitorNotifications:true}})
  })
  return {ok:true,data:monitorEditorDTO(result),...(result.pushToken?{provisioning:{pushToken:result.pushToken}}:{})}
})
