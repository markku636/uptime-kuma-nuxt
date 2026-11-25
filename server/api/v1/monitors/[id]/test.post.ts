import { createMonitorSchema } from '../../../../utils/monitor-input'
import { applyMonitorUpdates } from '../../../../utils/monitor-secrets'
import { trialMonitor } from '../../../../utils/monitor-trial'
import { resolveMonitorConfig } from '../../../../utils/monitor-config'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor'),id=Number(getRouterParam(event,'id'))
  const monitor=await prisma.monitor.findFirst({where:{id,workspaceId:scope.workspaceId,environmentId:scope.environmentId}})
  if(!monitor)throw createError({statusCode:404,message:'Monitor not found'})
  const body=await readBody(event)||{},parsed=createMonitorSchema.partial().safeParse(body)
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid monitor trial configuration'})
  const updates=Object.fromEntries(Object.entries(parsed.data).filter(([key])=>Object.hasOwn(body,key)))
  const input=applyMonitorUpdates(monitor,updates)
  // Trials must see the same {{environment variable}} values as scheduled checks.
  // Missing/unsupported variables are checker config errors, not a 500 from the endpoint.
  let resolved:any
  try { resolved=await resolveMonitorConfig(input,undefined,prisma) }
  catch { resolved={...input,workspaceId:scope.workspaceId,environmentId:scope.environmentId} }
  return trialMonitor(scope.user.id,resolved)
})
