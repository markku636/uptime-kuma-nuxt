import { createMonitorSchema } from '../../../utils/monitor-input'
import { resolveMonitorConfig } from '../../../utils/monitor-config'
import { trialMonitor } from '../../../utils/monitor-trial'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor')
  const parsed=createMonitorSchema.safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid monitor trial configuration'})
  // Bruno requests carry their destination inside the .bru body, not in a URL field.
  if(parsed.data.type!=='bruno'&&!parsed.data.url)throw createError({statusCode:400,message:'URL is required'})
  // Trials must see the same {{environment variable}} values as scheduled checks.
  // Missing/unsupported variables are reported by the checker as CONFIG_ERROR, not a 500.
  let resolved: any
  try { resolved=await resolveMonitorConfig({...parsed.data,workspaceId:scope.workspaceId,environmentId:scope.environmentId}) }
  catch { resolved={...parsed.data,workspaceId:scope.workspaceId,environmentId:scope.environmentId} }
  return trialMonitor(scope.user.id,resolved)
})
