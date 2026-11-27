import http from 'node:http'
import { z } from 'zod'
import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from './prisma'
import { requireWorkspace } from './workspace'
import { parseResourceInput, validateResource } from './resource-input'
import { applyResourceUpdates, type SecretResource } from './resource-secrets'
import { executeHttpRequest } from '../services/monitor/checkers/http-request'
import { sendNotification } from '../services/notification/sender'
let total=0
const active=new Set<number>(),windows=new Map<number,{time:number,count:number}>()
function socketPing(socketPath:string){
  return new Promise<void>((resolve,reject)=>{
    let settled=false,size=0
    const finish=(error?:Error)=>{if(settled)return;settled=true;clearTimeout(timer);request.destroy();error?reject(error):resolve()}
    const request=http.request({socketPath,path:'/_ping',method:'GET',maxHeaderSize:8192},response=>{
      response.on('data',chunk=>{size+=chunk.length;if(size>65536)finish(new Error('RESPONSE_TOO_LARGE'))})
      response.on('end',()=>finish(response.statusCode===200?undefined:new Error('CONNECTION_FAILED')))
      response.on('error',()=>finish(new Error('CONNECTION_FAILED')))
    })
    const timer=setTimeout(()=>finish(new Error('TIMEOUT')),10000);timer.unref()
    request.on('error',()=>finish(new Error('CONNECTION_FAILED')));request.end()
  })
}
export function resourceProbeHandler(kind:SecretResource){
  return defineEventHandler(async event=>{
    const scope=await requireWorkspace(event,'editor'),body=await readBody(event)
    if(!body||typeof body!=='object'||Array.isArray(body))throw createError({statusCode:400,message:'Invalid resource test'})
    const {id,notificationId,dockerHostId,remoteBrowserId,overrides,eventStatus,...direct}=body
    // 通知測試可指定送 UP（預設）或 DOWN；DOWN 才會帶出agent 指令等告警專用內容。
    const probeStatus=z.enum(['up','down']).default('up').safeParse(eventStatus)
    if(!probeStatus.success)throw createError({statusCode:400,message:'Invalid eventStatus'})
    const resourceId=id??notificationId??dockerHostId??remoteBrowserId
    let existing:any
    if(resourceId!==undefined){
      if(!Number.isSafeInteger(resourceId)||resourceId<1)throw createError({statusCode:404,message:'Resource not found'})
      existing=await (prisma as any)[kind].findFirst({where:{id:resourceId,workspaceId:scope.workspaceId}})
      if(!existing)throw createError({statusCode:404,message:'Resource not found'})
    }
    const input=parseResourceInput(kind,overrides??direct),row=applyResourceUpdates(kind,existing||{id:0,workspaceId:scope.workspaceId},input)
    if(kind==='notification'&&existing&&input.type!==undefined&&input.type!==existing.type&&input.config===undefined&&!input.clearSecrets?.includes('config'))throw createError({statusCode:400,message:'Replacing provider requires replacement configuration'})
    validateResource(kind,{name:'Connection test',...row},existing)
    const now=Date.now(),old=windows.get(scope.user.id),window=old&&now-old.time<60000?old:{time:now,count:0}
    if(total>=8||active.has(scope.user.id)||window.count>=10)throw createError({statusCode:429,message:'Test capacity reached'})
    if(windows.size>10000)for(const [id,w]of windows)if(now-w.time>=60000)windows.delete(id)
    if(windows.size>=10000&&!windows.has(scope.user.id))throw createError({statusCode:503,message:'Test capacity reached'})
    windows.set(scope.user.id,window);window.count++;active.add(scope.user.id);total++
    try{
      if(kind==='notification'){
        const down=probeStatus.data==='down'
        await sendNotification({type:row.type,config:row.config},{name:'Test Monitor'},
          {status:down?0:1,ping:0,msg:'Test',code:down?'TEST_DOWN':'CHECK_COMPLETE',...(down?{eventType:'test-down'}:{})})
      }
      else if(kind==='dockerHost'&&row.dockerType==='socket'){
        if(typeof row.dockerDaemon!=='string'||!row.dockerDaemon.startsWith('/'))throw new Error('CONFIG_ERROR')
        await socketPing(row.dockerDaemon)
      }else{
        const target=new URL(kind==='remoteBrowser'?row.url:row.connectionUrl)
        if(kind==='remoteBrowser'){
          target.protocol=target.protocol==='wss:'?'https:':target.protocol==='ws:'?'http:':target.protocol
          if(!target.pathname.endsWith('/json/version'))target.pathname='/json/version'
        }else{target.protocol=target.protocol==='tcp:'?'http:':target.protocol;target.pathname='/_ping'}
        const result=await executeHttpRequest({url:target.href,timeout:10,maxRedirects:0})
        if(result.status!==200)throw new Error('CONNECTION_FAILED')
        if(kind==='remoteBrowser'){
          const json=JSON.parse(result.body)
          if(!json||typeof json.Browser!=='string')throw new Error('INVALID_RESPONSE')
        }
      }
      return {ok:true,success:true,code:'CONNECTION_OK',message:'Connection successful'}
    }catch(error:any){
      const code=error?.message==='UNSUPPORTED_PROVIDER'?'UNSUPPORTED_PROVIDER':error?.code==='TIMEOUT'||error?.message==='TIMEOUT'?'TIMEOUT':'CONNECTION_FAILED'
      return {ok:false,success:false,code,message:code}
    }finally{active.delete(scope.user.id);total--}
  })
}
