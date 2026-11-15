import {fenceEnvironment,fenceMonitorData,databaseNow,initialMonitorSchedule} from '../../utils/monitor-mutation'
import {createHmac,timingSafeEqual} from 'node:crypto'
import {Prisma} from '@prisma/client'
import type {BrunoManifest,BrunoParsed} from '../../../shared/types/bruno'
import type {RequestPrincipal} from '../../utils/request-session'
import {prisma} from '../../utils/prisma'
import {decryptSecret,encryptSecret} from '../../utils/variables'
import {monitorDbInput} from '../../utils/monitor-secrets'
import {stopMonitorJob} from '../monitor/scheduler'
import {parseBrunoManifest} from './parser'
import {resolveBrunoGroups} from '../groups'

type SourceState={environment:any;sources:any[];values:Record<string,string>}
function canonical(value:any):any{
  if(value instanceof Date)return value.toISOString()
  if(Array.isArray(value))return value.map(canonical)
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]))
  return value
}
function digest(manifest:BrunoManifest,scope:RequestPrincipal,state:SourceState){
  const key=process.env.APP_ENCRYPTION_KEY;if(!key||!/^[a-f\d]{64}$/i.test(key))throw new Error('Encryption key unavailable')
  const input={...manifest,files:[...manifest.files].sort((a,b)=>a.path.localeCompare(b.path))}
  return createHmac('sha256',Buffer.from(key,'hex')).update(JSON.stringify(canonical({input,userId:scope.user.id,workspaceId:scope.workspaceId,environmentId:scope.environmentId,
    variables:state.environment.variables,secrets:state.environment.secrets,sources:state.sources.map(row=>({path:row.path,monitorId:row.monitorId,updatedAt:row.updatedAt,configVersion:row.monitor.configVersion}))}))).digest('hex')
}
async function sourceState(scope:RequestPrincipal,manifest:BrunoManifest,db:any=prisma):Promise<SourceState>{
  const [environment,sources]=await Promise.all([
    db.environment.findFirst({where:{id:scope.environmentId,workspaceId:scope.workspaceId}}),
    db.brunoSource.findMany({where:{workspaceId:scope.workspaceId,environmentId:scope.environmentId,collectionId:manifest.collectionId,sourceEnvironment:manifest.sourceEnvironment||''},include:{monitor:{select:{configVersion:true}}},orderBy:{path:'asc'},take:10001})
  ])
  if(!environment)throw createError({statusCode:404,message:'Environment not found'})
  if(sources.length>10000)throw createError({statusCode:413,message:'Collection source limit exceeded'})
  const values:Record<string,string>={...environment.variables}
  for(const [name,value]of Object.entries(environment.secrets||{}))values[name]=decryptSecret(value as string,`${scope.workspaceId}:${scope.environmentId}:${name}`)
  return {environment,sources,values}
}
function environmentChanges(parsed:BrunoParsed,state:SourceState){
  return Object.entries(parsed.variables).some(([name,value])=>state.environment.variables[name]!==value||Object.hasOwn(state.environment.secrets,name))
    ||Object.entries(parsed.secrets).some(([name,value])=>!Object.hasOwn(state.environment.secrets,name)||state.values[name]!==value||Object.hasOwn(state.environment.variables,name))
}
function issuesFor(parsed:BrunoParsed,state:SourceState,manifest:BrunoManifest,canChangeEnvironment:boolean){
  const issues=[...parsed.issues]
  if(environmentChanges(parsed,state)&&!canChangeEnvironment)issues.push({file:manifest.sourceEnvironment||'',code:'OWNER_REQUIRED_FOR_ENVIRONMENT'})
  if(manifest.mode==='create')for(const row of state.sources)if(parsed.requests.some(request=>request.path===row.path)&&issues.length<100)issues.push({file:row.path,code:'ALREADY_IMPORTED'})
  return issues
}
export async function previewBruno(scope:RequestPrincipal,manifest:BrunoManifest,canChangeEnvironment:boolean){
  const state=await sourceState(scope,manifest),parsed=await parseBrunoManifest(manifest,state.values,Object.keys(state.environment.secrets)),existing=new Set(state.sources.map(row=>row.path))
  const issues=issuesFor(parsed,state,manifest,canChangeEnvironment)
  const groups=issues.length?[]:await resolveBrunoGroups(prisma,scope.workspaceId,manifest,parsed,false)
  return {ok:issues.length===0,groups,collectionName:parsed.collectionName||null,digest:digest(manifest,scope,state),issues,environments:parsed.environments,missingSecrets:parsed.missingSecrets,
    environmentChanges:environmentChanges(parsed,state),variableNames:Object.keys(parsed.variables),secretNames:Object.keys(parsed.secrets),
    counts:{requests:parsed.requests.length,create:parsed.requests.filter(row=>!existing.has(row.path)).length,replace:manifest.mode==='replace'?parsed.requests.filter(row=>existing.has(row.path)).length:0,skip:manifest.mode==='skip'?parsed.requests.filter(row=>existing.has(row.path)).length:0},
    requests:parsed.requests.map(row=>({path:row.path,name:row.name,method:row.config.method,assertionCount:row.config.assertions?.rules.length||0,action:existing.has(row.path)?manifest.mode==='skip'?'skip':manifest.mode==='replace'?'replace':'conflict':'create',requestConfigured:true,folder:row.folder,skipped:row.skipped}))}
}
export async function importBruno(scope:RequestPrincipal,manifest:BrunoManifest,expectedDigest:string,canChangeEnvironment:boolean,apiKeyId?:number){
  const initial=await sourceState(scope,manifest),parsed=await parseBrunoManifest(manifest,initial.values,Object.keys(initial.environment.secrets))
  const issues=issuesFor(parsed,initial,manifest,canChangeEnvironment)
  if(issues.length)throw createError({statusCode:400,message:'Bruno manifest is not supported or requires correction',data:{issues,missingSecrets:parsed.missingSecrets}})
  if(!/^[a-f\d]{64}$/.test(expectedDigest)||!timingSafeEqual(Buffer.from(expectedDigest,'hex'),Buffer.from(digest(manifest,scope,initial),'hex')))throw createError({statusCode:409,message:'Preview changed; preview the original files again'})
  const changedIds:number[]=[],createdIds:number[]=[],skippedIds:number[]=[]
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT id FROM workspaces WHERE id=${scope.workspaceId} FOR UPDATE`
    const [member,user]=await Promise.all([
      tx.workspaceMember.findUnique({where:{workspaceId_userId:{workspaceId:scope.workspaceId,userId:scope.user.id}}}),
      tx.user.findUnique({where:{id:scope.user.id},select:{active:true,sessionVersion:true}})
    ])
    if(!user?.active||user.sessionVersion!==scope.user.sessionVersion||!member||!['editor','owner'].includes(member.role))throw createError({statusCode:403,message:'Workspace permission changed'})
    if(apiKeyId){const key=await tx.apiKey.findFirst({where:{id:apiKeyId,active:true,scope:'write',workspaceId:scope.workspaceId,userId:scope.user.id,OR:[{expires:null},{expires:{gt:new Date()}}]}});if(!key)throw createError({statusCode:403,message:'API key permission changed'})}
    await tx.$executeRaw`SELECT id FROM environments WHERE id=${scope.environmentId} FOR UPDATE`
    let current=await sourceState(scope,manifest,tx)
    const lockedIds=current.sources.map(row=>row.monitorId)
    if(lockedIds.length)await tx.$executeRaw`SELECT id FROM monitors WHERE id IN (${Prisma.join(lockedIds)}) ORDER BY id FOR UPDATE`
    current=await sourceState(scope,manifest,tx)
    if(digest(manifest,scope,current)!==expectedDigest)throw createError({statusCode:409,message:'Preview state changed; preview again'})
    if(environmentChanges(parsed,current)){
      if(!canChangeEnvironment||member.role!=='owner'||apiKeyId)throw createError({statusCode:403,message:'Workspace owner session required for environment changes'})
      const variables:Record<string,string>={...current.environment.variables as Record<string,string>},secrets:Record<string,string>={...current.environment.secrets as Record<string,string>}
      for(const [name,value]of Object.entries(parsed.variables)){variables[name]=value;delete secrets[name]}
      for(const [name,value]of Object.entries(parsed.secrets)){secrets[name]=encryptSecret(value,`${scope.workspaceId}:${scope.environmentId}:${name}`);delete variables[name]}
      if(Object.keys(variables).length+Object.keys(secrets).length>200||Buffer.byteLength(JSON.stringify({variables,secrets}))>262144)throw createError({statusCode:400,message:'Target environment variable limit exceeded'})
      await tx.environment.update({where:{id:scope.environmentId},data:{variables,secrets}})
      await fenceEnvironment(tx,scope.workspaceId,scope.environmentId)
    }
    const lockedMonitors=lockedIds.length?await tx.monitor.findMany({where:{id:{in:lockedIds}},select:{id:true,interval:true,active:true,groupId:true}}):[],monitorsById=new Map(lockedMonitors.map(row=>[row.id,row]))
    // Folders become groups; a replaced monitor keeps a group the user moved it to.
    const groupIds=new Map((await resolveBrunoGroups(tx,scope.workspaceId,manifest,parsed,true)).map(plan=>[plan.path,plan.groupId]))
    const sources=new Map(current.sources.map(row=>[row.path,row])),newRequests=parsed.requests.filter(row=>!sources.has(row.path))
    const ids=newRequests.length?await tx.$queryRaw<{id:number}[]>`SELECT nextval(pg_get_serial_sequence('monitors','id'))::integer AS id FROM generate_series(1,${newRequests.length}::integer)`:[]
    let index=0;const scheduleTime=await databaseNow(tx),creates:any[]=[],mappings:any[]=[]
    for(const request of parsed.requests){
      const source=sources.get(request.path)
      if(source&&manifest.mode==='skip'){skippedIds.push(source.monitorId);continue}
      if(source&&manifest.mode!=='replace')throw createError({statusCode:409,message:'Source already imported'})
      const id=source?.monitorId??ids[index++]!.id
      const {clearSecrets,tags,notifications,...config}=request.config
      const groupId=groupIds.get(request.folder)??null
      const record:any=monitorDbInput({...config,id,workspaceId:scope.workspaceId,environmentId:scope.environmentId,
        ...(source?{}:{userId:scope.user.id}),...(!source||monitorsById.get(id)?.groupId==null?{groupId}:{}),
        active:false,authMethod:config.authMethod||'none',keyword:null,jsonPath:null,expectedValue:null,proxyId:null})
      for(const key of ['assertions','acceptedStatuscodes','tlsExpiryDays'])if(record[key]===null)record[key]=Prisma.DbNull
      if(source){
        await tx.monitor.update({where:{id,workspaceId:scope.workspaceId,environmentId:scope.environmentId},data:await fenceMonitorData(tx,monitorsById.get(id),record)})
        await tx.brunoSource.update({where:{id:source.id},data:{updatedAt:new Date(),ignoredBlocks:request.skipped}});changedIds.push(id)
      }else{
        creates.push({...record,...initialMonitorSchedule(id,config.interval,scheduleTime)});mappings.push({workspaceId:scope.workspaceId,environmentId:scope.environmentId,collectionId:manifest.collectionId,sourceEnvironment:manifest.sourceEnvironment||'',path:request.path,monitorId:id,ignoredBlocks:request.skipped});createdIds.push(id)
      }
    }
    for(let start=0;start<creates.length;start+=250){await tx.monitor.createMany({data:creates.slice(start,start+250)});await tx.brunoSource.createMany({data:mappings.slice(start,start+250)})}
  },{timeout:120000,maxWait:10000})
  changedIds.forEach(stopMonitorJob)
  const withSkippedBlocks=parsed.requests.filter(request=>request.skipped.length).length
  return {ok:true,data:{createdIds,replacedIds:changedIds,skippedIds,paused:true,withSkippedBlocks},notice:'Imported requests are paused. Configure any missing credentials before activation.'}
}
