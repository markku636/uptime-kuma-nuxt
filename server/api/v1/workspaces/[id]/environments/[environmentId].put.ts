import { z } from 'zod'
import { environmentDTO, encryptSecret, validVariableName } from '../../../../../utils/variables'
import { fenceEnvironment } from '../../../../../utils/monitor-mutation'
const variableName=z.string().refine(validVariableName,'Unsupported variable name')
const schema=z.object({name:z.string().trim().min(1).max(100).optional(),variables:z.record(variableName,z.string().max(65536)).optional(),secrets:z.record(variableName,z.string().max(65536).nullable()).optional()})
export default defineEventHandler(async event=>{
  const scope=await requireWorkspace(event,'owner'),id=Number(getRouterParam(event,'environmentId')),body=await readValidatedBody(event,schema.parse)
  if(Object.keys(body.variables||{}).length>200||Object.keys(body.secrets||{}).length>200)throw createError({statusCode:400,message:'At most 200 variables and secrets per update'})
  const updated=await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    const member=await tx.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:scope.workspaceId,userId:scope.user.id}}})
    if(member?.role!=='owner')throw createError({statusCode:403,message:'Workspace permission changed'})
    await tx.$queryRaw`SELECT id FROM environments WHERE id=${id} AND workspace_id=${scope.workspaceId} FOR UPDATE`
    const environment=await tx.environment.findFirst({where:{id,workspaceId:scope.workspaceId}})
    if(!environment)throw createError({statusCode:404,message:'Environment not found'})
    const secrets={...environment.secrets as Record<string,string>}
    for(const [name,value]of Object.entries(body.secrets||{})){if(value===null)delete secrets[name];else secrets[name]=encryptSecret(value,`${scope.workspaceId}:${id}:${name}`)}
    const variables=body.variables||environment.variables as Record<string,string>
    if(Object.keys(variables).some(name=>Object.hasOwn(secrets,name)))throw createError({statusCode:400,message:'Variable and secret names must be distinct'})
    if(Object.keys(variables).length+Object.keys(secrets).length>200||Buffer.byteLength(JSON.stringify({variables,secrets}))>262144)throw createError({statusCode:400,message:'Environment variables exceed size limit'})
    if(body.variables!==undefined||body.secrets!==undefined)await fenceEnvironment(tx,scope.workspaceId,id)
    return tx.environment.update({where:{id},data:{name:body.name,variables:body.variables,secrets}})
  })
  return {ok:true,data:environmentDTO(updated)}
})
