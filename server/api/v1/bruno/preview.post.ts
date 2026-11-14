import {brunoInputSchema} from '../../../utils/bruno-input'
import {previewBruno} from '../../../services/bruno/importer'
import {withBrunoCapacity} from '../../../services/bruno/guard'
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'editor'),parsed=brunoInputSchema.safeParse(await readBody(event))
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid Bruno manifest'})
  const {digest,...manifest}=parsed.data
  return withBrunoCapacity(scope.user.id,()=>previewBruno(scope,manifest,scope.role==='owner'&&event.context.authMethod==='session'))
})
