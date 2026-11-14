import {brunoInputSchema} from '../../../utils/bruno-input'
import {importBruno} from '../../../services/bruno/importer'
import {withBrunoCapacity} from '../../../services/bruno/guard'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor'),parsed=brunoInputSchema.safeParse(await readBody(event))
  if(!parsed.success||!parsed.data.digest)throw createError({statusCode:400,message:'Original Bruno files and preview digest are required'})
  const {digest,...manifest}=parsed.data
  try{return await withBrunoCapacity(scope.user.id,()=>importBruno(scope,manifest,digest,scope.role==='owner'&&event.context.authMethod==='session',event.context.apiKey?.id))}
  catch(error:any){if(error.statusCode)throw error;throw createError({statusCode:500,message:'Bruno import failed; no changes were committed'})}
})
