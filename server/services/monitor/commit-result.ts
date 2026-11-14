import {createHash} from 'node:crypto'
import type {CheckResult} from './checker'
function safeCode(code:unknown){return typeof code==='string'&&/^[A-Z0-9_]{1,64}$/.test(code)?code:'CHECK_COMPLETE'}
function safeAssertions(input:any){
  if(!input||!Array.isArray(input.rules))return undefined
  return {passed:!!input.passed,...(input.error&&['INVALID_JSON','JSON_LIMIT'].includes(input.error)?{error:input.error}:{}),rules:input.rules.slice(0,21).map((row:any)=>({ruleId:String(row.ruleId||'').slice(0,100),source:String(row.source||'').slice(0,20),operator:String(row.operator||'').slice(0,30),passed:!!row.passed,reason:/^[a-z_]{1,64}$/.test(row.reason)?row.reason:'evaluated'}))}
}
export async function commitMonitorResult(tx:any,monitor:any,result:CheckResult){
    const now=(await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now as Date
    let previous=await tx.monitorState.findUnique({where:{monitorId:monitor.id}})
    if(!previous){const legacy=await tx.heartbeat.findFirst({where:{monitorId:monitor.id},orderBy:[{time:'desc'},{id:'desc'}]});if(legacy)previous={status:legacy.status,statusChangedAt:legacy.time,checkedAt:legacy.time,revision:0n}}
    const changed=!previous||previous.status!==result.status,code=safeCode(result.code),ping=Math.min(300000,Math.max(0,Math.round(result.ping)))
    const heartbeat=await tx.heartbeat.create({data:{monitorId:monitor.id,runId:monitor.runId,scheduledFor:monitor.scheduledFor,configVersion:monitor.configVersion,time:now,status:result.status,ping,msg:result.status===1?'Up':result.status===3?'Under maintenance':result.status===2?'Pending':'Check failed',checkCode:code,assertionResults:safeAssertions(result.assertionResults),important:changed,duration:previous?Math.max(0,Math.floor((now.getTime()-previous.checkedAt.getTime())/1000)):0}})
    const state=await tx.monitorState.upsert({where:{monitorId:monitor.id},create:{monitorId:monitor.id,workspaceId:monitor.workspaceId,environmentId:monitor.environmentId,heartbeatId:heartbeat.id,runId:monitor.runId,status:result.status,ping,checkCode:code,checkedAt:now,statusChangedAt:now},update:{heartbeatId:heartbeat.id,runId:monitor.runId,status:result.status,ping,checkCode:code,checkedAt:now,statusChangedAt:changed?now:previous.statusChangedAt,revision:{increment:1}}})
    const tls=(result as any).tlsInfo
    const tlsWarning=monitor.expiryNotification&&!monitor.ignoreTls&&tls&&Number.isFinite(tls.daysRemaining)&&typeof tls.fingerprint==='string'&&tls.fingerprint.length>0
    if(previous&&changed&&[0,1].includes(result.status)||tlsWarning){
      const channels=await tx.notification.findMany({where:{workspaceId:monitor.workspaceId,active:true,OR:[{isDefault:true},{monitorNotifications:{some:{monitorId:monitor.id,monitor:{workspaceId:monitor.workspaceId}}}}]},select:{id:true},take:1000})
      if(previous&&changed&&[0,1].includes(result.status)&&channels.length)await tx.notificationOutbox.createMany({data:channels.map((channel:any)=>({runId:monitor.runId,eventType:'status',notificationId:channel.id,workspaceId:monitor.workspaceId,environmentId:monitor.environmentId,monitorId:monitor.id,payload:{monitorId:monitor.id,name:monitor.name,status:result.status,ping,code,time:now.toISOString()},nextAttemptAt:now})),skipDuplicates:true})
      if(tlsWarning&&channels.length){
        let days=monitor.tlsExpiryDays
        if(!Array.isArray(days)||!days.length){const setting=await tx.setting.findUnique({where:{key:'tlsExpiryNotifyDays'}});try{days=setting?JSON.parse(setting.value):[7,14,21]}catch{days=[7,14,21]}}
        const thresholds=[...new Set((Array.isArray(days)?days:[]).filter((day:any)=>Number.isInteger(day)&&day>0&&day<=365))] as number[]
        const reached=thresholds.filter(day=>tls.daysRemaining<=day)
        // Send the most urgent crossed threshold once per certificate and channel.
        const threshold=reached.length?Math.min(...reached):undefined
        if(threshold!==undefined)await tx.notificationOutbox.createMany({data:channels.map((channel:any)=>({runId:monitor.runId,eventType:'tls-expiry',notificationId:channel.id,workspaceId:monitor.workspaceId,environmentId:monitor.environmentId,monitorId:monitor.id,dedupeKey:createHash('sha256').update(`tls:${monitor.id}:${channel.id}:${tls.fingerprint}:${threshold}`).digest('hex'),payload:{monitorId:monitor.id,name:monitor.name,status:0,ping,code:'TLS_EXPIRY',certificateDays:Math.floor(tls.daysRemaining),time:now.toISOString()},nextAttemptAt:now})),skipDuplicates:true})
      }
    }
    return {now,heartbeat,state}
}
