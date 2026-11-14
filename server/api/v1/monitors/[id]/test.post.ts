import { createMonitorSchema } from '../../../../utils/monitor-input'
import { applyMonitorUpdates } from '../../../../utils/monitor-secrets'
import { trialMonitor } from '../../../../utils/monitor-trial'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor'),id=Number(getRouterParam(event,'id'))
  const monitor=await prisma.monitor.findFirst({where:{id,workspaceId:scope.workspaceId,environmentId:scope.environmentId}})
  if(!monitor)throw createError({statusCode:404,message:'Monitor not found'})
  const body=await readBody(event)||{},parsed=createMonitorSchema.partial().safeParse(body)
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid monitor trial configuration'})
  const updates=Object.fromEntries(Object.entries(parsed.data).filter(([key])=>Object.hasOwn(body,key)))
  const input=applyMonitorUpdates(monitor,updates)
  return trialMonitor(scope.user.id,input)
})
