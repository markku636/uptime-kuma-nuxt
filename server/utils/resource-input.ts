import { z } from 'zod'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from './prisma'
import { requireWorkspace } from './workspace'
import { applyResourceUpdates, resourceDefinitions, resourceDTO, reserveResourceId, sealResource, type SecretResource } from './resource-secrets'
export const supportedNotificationTypes=['webhook','discord','slack','telegram','line']
const text=z.string().max(8192),name=z.string().trim().min(1).max(200)
const config=z.record(z.string().max(200),z.unknown()).refine(value=>{
  try{return Object.keys(value).length<=100&&Buffer.byteLength(JSON.stringify(value))<=65536}catch{return false}
},'Invalid notification configuration')
const fields={
  notification:z.object({name,type:z.string().min(1).max(64),config,isDefault:z.boolean(),active:z.boolean()}),
  proxy:z.object({protocol:z.enum(['http','https','socks','socks5']),host:text,port:z.number().int().min(1).max(65535),auth:z.boolean(),username:text.nullable(),password:text.nullable(),isDefault:z.boolean(),active:z.boolean()}),
  dockerHost:z.object({name,dockerType:z.enum(['socket','tcp']),dockerDaemon:text.nullable(),connectionUrl:text.nullable(),active:z.boolean()}),
  remoteBrowser:z.object({name,url:text,active:z.boolean()}),
}
export function parseResourceInput(kind:SecretResource,input:unknown){
  const parsed=fields[kind].partial().extend({clearSecrets:z.array(z.enum(resourceDefinitions[kind].fields as any)).max(5).optional()}).strict().safeParse(input)
  if(!parsed.success)throw createError({statusCode:400,message:'Invalid resource configuration'})
  return parsed.data as Record<string,any>
}
export function validateResource(kind:SecretResource,row:any,existing?:any){
  if(kind!=='proxy'&&!row.name)throw createError({statusCode:400,message:'Name is required'})
  if(kind==='notification'){
    if(!row.type)throw createError({statusCode:400,message:'Provider is required'})
    if((!existing||row.type!==existing.type)&&!supportedNotificationTypes.includes(row.type))throw createError({statusCode:400,message:'UNSUPPORTED_PROVIDER'})
  }
  if(kind==='proxy'&&(!row.protocol||!row.port))throw createError({statusCode:400,message:'Protocol and port are required'})
  if(kind==='remoteBrowser'&&row.url){try{if(!['http:','https:','ws:','wss:'].includes(new URL(row.url).protocol))throw 0}catch{throw createError({statusCode:400,message:'Invalid endpoint configuration'})}}
}
function response(kind:SecretResource,value:any){return kind==='proxy'||kind==='dockerHost'?value:{ok:true,success:true,data:value}}
export function secretResourceHandler(kind:SecretResource,action:'list'|'create'|'update'){
  return defineEventHandler(async event=>{
    const scope=await requireWorkspace(event,action==='list'?'viewer':'editor'),model=(prisma as any)[kind]
    if(action==='list')return response(kind,(await model.findMany({where:{workspaceId:scope.workspaceId},orderBy:{id:'asc'},take:1000})).map((row:any)=>resourceDTO(kind,row)))
    const input=parseResourceInput(kind,await readBody(event)),id=Number(getRouterParam(event,'id'))
    const result=await prisma.$transaction(async(tx:any)=>{
      let existing:any
      if(action==='update'){
        if(!Number.isSafeInteger(id)||id<1)throw createError({statusCode:404,message:'Resource not found'})
        await tx.$queryRawUnsafe(`SELECT id FROM "${resourceDefinitions[kind].table}" WHERE id=$1 AND workspace_id=$2 FOR UPDATE`,id,scope.workspaceId)
        existing=await tx[kind].findFirst({where:{id,workspaceId:scope.workspaceId}})
        if(!existing)throw createError({statusCode:404,message:'Resource not found'})
      }
      const membership=await tx.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:scope.workspaceId,userId:scope.user.id}}})
      if(!membership||!['owner','editor'].includes(membership.role))throw createError({statusCode:403,message:'Insufficient workspace permission'})
      if(kind==='notification'&&existing&&input.type!==undefined&&input.type!==existing.type&&input.config===undefined&&!input.clearSecrets?.includes('config'))throw createError({statusCode:400,message:'Replacing provider requires replacement configuration'})
      const base=existing||{id:await reserveResourceId(tx,kind),workspaceId:scope.workspaceId,userId:scope.user.id,active:true,isDefault:false,auth:false,dockerType:'socket',...resourceDefinitions[kind].empty}
      const merged=applyResourceUpdates(kind,base,input)
      validateResource(kind,merged,existing)
      if(action==='create'&&((kind==='proxy'&&!merged.host)||(kind==='remoteBrowser'&&!merged.url)||(kind==='dockerHost'&&!(merged.dockerType==='socket'?merged.dockerDaemon:merged.connectionUrl))))throw createError({statusCode:400,message:'Endpoint configuration is required'})
      if(merged.isDefault&&kind==='proxy')await tx.proxy.updateMany({where:{workspaceId:scope.workspaceId,isDefault:true},data:{isDefault:false}})
      const {clearSecrets,...updates}=input
      const data={...updates,...sealResource(kind,merged)}
      if(existing)return tx[kind].update({where:{id},data})
      const defaults:any={id:base.id,workspaceId:base.workspaceId,userId:base.userId,active:true}
      if(kind==='proxy'||kind==='notification')defaults.isDefault=false
      if(kind==='proxy')defaults.auth=false
      return tx[kind].create({data:{...defaults,...data}})
    })
    return response(kind,resourceDTO(kind,result))
  })
}
