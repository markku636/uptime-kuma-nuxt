import {parseBrunoManifest} from '../../../services/bruno/parser'
import {z} from 'zod'
import {exportBrunoMonitors,BrunoExportError} from '../../../services/bruno/exporter'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'owner'),query=getQuery(event)
  const parsed=z.object({ids:z.string().max(512).optional()}).safeParse(query)
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid export selection'})
  const ids=parsed.data.ids?[...new Set(parsed.data.ids.split(',').map(Number))]:undefined
  if(ids&&(ids.length>20||ids.some(id=>!Number.isSafeInteger(id)||id<=0)))throw createError({statusCode:400,message:'Select at most 20 monitor IDs'})
  const monitors=await prisma.monitor.findMany({where:{workspaceId:scope.workspaceId,environmentId:scope.environmentId,...(ids?{id:{in:ids}}:{})},orderBy:{id:'asc'},take:21})
  if(ids&&monitors.length!==ids.length)throw createError({statusCode:404,message:'Monitor not found'})
  if(!monitors.length||monitors.length>20)throw createError({statusCode:400,message:'Select between 1 and 20 monitors using ids'})
  try{
    const output=exportBrunoMonitors(monitors,`export-${scope.workspaceId}-${scope.environmentId}`)
    const {secretNames,notice,...manifest}=output
    const check=await parseBrunoManifest({...manifest,secrets:Object.fromEntries(secretNames.map(name=>[name,name.endsWith('_url')?'http://127.0.0.1/':'configure']))})
    if(check.issues.length)throw new BrunoExportError(0,'UNREPRESENTABLE_BRUNO_SYNTAX')
    return {ok:true,data:output}
  }
  catch(error){if(error instanceof BrunoExportError)throw createError({statusCode:400,message:'Selected configuration cannot be represented by the supported Bruno subset',data:{monitorId:error.monitorId,code:error.code}});throw createError({statusCode:500,message:'Export unavailable'})}
})
