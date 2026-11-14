import { createMonitorSchema } from '../../../utils/monitor-input'
import { trialMonitor } from '../../../utils/monitor-trial'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor')
  const parsed=createMonitorSchema.safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid monitor trial configuration'})
  if(!parsed.data.url)throw createError({statusCode:400,message:'URL is required'})
  return trialMonitor(scope.user.id,{...parsed.data,workspaceId:scope.workspaceId,environmentId:scope.environmentId})
})
