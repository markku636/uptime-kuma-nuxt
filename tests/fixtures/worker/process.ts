import {initializeRuntime,drainRuntime,runtimeState} from '../../../server/services/monitor/runtime'
import {NotificationDispatcher} from '../../../server/services/notification/dispatcher'
import {claimNotifications,renewNotificationLease,acknowledgeNotification} from '../../../server/services/notification/outbox'
import {executeHttpRequest} from '../../../server/services/monitor/checkers/http-request'
import {hydrateMonitor} from '../../../server/utils/monitor-secrets'
import {MonitorWorker} from '../../../server/services/monitor/worker'
import {runtimeOptions} from '../../../server/services/monitor/runtime-config'
import {claimMonitors,renewMonitorLease} from '../../../server/services/monitor/leases'
import {completeMonitorRun} from '../../../server/services/monitor/completion'
import {workerPrisma as db} from '../../../server/utils/worker-prisma'
import {prisma} from '../../../server/utils/prisma'
const owner=process.env.TEST_WORKER_ID||crypto.randomUUID()
const delayedDb={
  $transaction:async(...args:any[])=>{const value=await (db.$transaction as any)(...args);const delay=Number(process.env.TEST_CLAIM_RETURN_DELAY_MS||0);if(delay)await new Promise(r=>setTimeout(r,delay));return value},
  $queryRaw:async(...args:any[])=>{const value=await (db.$queryRaw as any)(...args);const delay=Number(process.env.TEST_RENEW_RETURN_DELAY_MS||0);if(delay&&String(args[0]?.sql||'').includes('UPDATE monitors SET lease_until'))await new Promise(r=>setTimeout(r,delay));return value},
  $executeRaw:db.$executeRaw.bind(db),monitor:db.monitor,environment:db.environment,maintenanceMonitor:{findMany:async(...args:any[])=>{if(process.env.TEST_MAINTENANCE_GATE){send({maintenanceQuery:true});await new Promise(r=>setTimeout(r,200))}return (db.maintenanceMonitor.findMany as any)(...args)}},
}

let leases:any[]=[],outbox:any[]=[],worker:MonitorWorker|undefined,dispatcher:NotificationDispatcher|undefined
const send=(input:any)=>process.send?.(JSON.parse(JSON.stringify(input,(_key,value)=>typeof value==='bigint'?value.toString():value)))
process.on('message',async(message:any)=>{
  try{
    if(message.action==='runtimeStart'){await initializeRuntime();send({id:message.id,state:runtimeState})}
    else if(message.action==='runtimeDrain'){await drainRuntime();send({id:message.id,state:runtimeState})}
    else if(message.action==='runtimeState')send({id:message.id,state:runtimeState})
    else if(message.action==='databaseSettings'){const settings=await db.$transaction(async tx=>({statement:await tx.$queryRawUnsafe('SHOW statement_timeout'),lock:await tx.$queryRawUnsafe('SHOW lock_timeout')}));const start=Date.now();let timedOut=false;try{await db.$queryRawUnsafe('SELECT pg_sleep(4)')}catch{timedOut=true}send({id:message.id,settings,timedOut,elapsed:Date.now()-start})}
    else if(message.action==='outboxClaim'){outbox=await claimNotifications(owner,message.limit||1,message.leaseMs||2000,message.maxAttempts||5,db);send({id:message.id,rows:outbox})}
    else if(message.action==='outboxRenew')send({id:message.id,renewed:await renewNotificationLease(outbox[0],message.leaseMs||2000,db)})
    else if(message.action==='outboxAck')send({id:message.id,accepted:await acknowledgeNotification(outbox[0],message.status||'delivered',null,0,db)})
    else if(message.action==='dispatch'){dispatcher=new NotificationDispatcher(runtimeOptions(),db,owner);dispatcher.start();send({id:message.id,started:true})}
    else if(message.action==='dispatchStatus')send({id:message.id,status:dispatcher?.status()})
    else if(message.action==='claim'){leases=await claimMonitors(owner,message.limit||1,message.leaseMs||2000,db);send({id:message.id,leases})}
    else if(message.action==='checkOnly'){await executeHttpRequest(hydrateMonitor(leases[0]));send({id:message.id,checked:true})}
    else if(message.action==='renew')send({id:message.id,renewed:await renewMonitorLease(leases[0],message.leaseMs||2000,db)})
    else if(message.action==='complete')send({id:message.id,...await completeMonitorRun(leases[0],{status:message.status??1,ping:1,msg:'DO_NOT_PERSIST_REQUEST_SENTINEL',code:'CHECK_OK',...(message.tls?{tlsInfo:message.tls}:{})},db)})
    else if(message.action==='run'){worker=new MonitorWorker(runtimeOptions(),delayedDb,owner);worker.start();send({id:message.id,started:true})}
    else if(message.action==='status')send({id:message.id,status:{...worker?.status(),memory:process.memoryUsage()}})
    else if(message.action==='stop'){await Promise.allSettled([worker?.stop(),dispatcher?.stop()]);await db.$disconnect();await prisma.$disconnect();send({id:message.id,stopped:true});process.exit(0)}
  }catch(error:any){console.info('FIXTURE_ERROR_SHAPE',JSON.stringify({name:error?.name,code:error?.code,kind:error?.cause?.kind,causeCode:error?.cause?.code,metaCode:error?.meta?.code}));send({id:message.id,error:'WORKER_FIXTURE_FAILED'})}
})
process.on('SIGTERM',async()=>{await Promise.allSettled([worker?.stop(),dispatcher?.stop()]);await db.$disconnect();await prisma.$disconnect();process.exit(0)})
send({ready:true,owner})
