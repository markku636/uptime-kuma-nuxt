import {hostname} from 'node:os'
import {workerPrisma as prisma} from '../../utils/worker-prisma'
import {securityReady} from '../../utils/security-bootstrap'
import {transientDatabaseError} from '../../utils/database-errors'
import {StateBridge} from '../events/state-bridge'
import {NotificationDispatcher} from '../notification/dispatcher'
import {MonitorWorker} from './worker'
import {HistoryMaintenance} from '../uptime/background'
import {cleanupRuntime} from './cleanup'
import {runtimeOptions,workerInstanceId} from './runtime-config'
// Pod/node identity shown on Settings → Nodes; HOSTNAME is the Pod name in Kubernetes, NODE_NAME comes from the downward API.
const identity={host:hostname(),node:process.env.NODE_NAME||null,release:process.env.RELEASE_SHA?.slice(0,12)||null}
export const runtimeState={ready:false,draining:false,startedAt:new Date(),databaseHealthy:false,initializationFailures:0,drainPhase:'idle'}
let bridge:StateBridge|undefined,dispatcher:NotificationDispatcher|undefined,worker:MonitorWorker|undefined
let history:HistoryMaintenance|undefined
let heartbeat:NodeJS.Timeout|undefined,retry:NodeJS.Timeout|undefined,cleanup:NodeJS.Timeout|undefined,starting:Promise<void>|undefined,draining:Promise<void>|undefined,retryMs=1000
export function runtimeWorker(){return worker}
export function runtimeDispatcher(){return dispatcher}
export function runtimeBridge(){return bridge}
export function initializeRuntime(){
  if(starting)return starting
  const attempt=(async()=>{
    const options=runtimeOptions();await securityReady();if(runtimeState.draining)return
    await prisma.$executeRaw`INSERT INTO worker_instances(instance_id,role,started_at,last_seen,draining,concurrency,inflight,metrics) VALUES(${workerInstanceId}::uuid,${options.role},clock_timestamp(),clock_timestamp(),false,${options.role==='api'?0:options.concurrency},0,${JSON.stringify(identity)}::jsonb) ON CONFLICT(instance_id) DO UPDATE SET last_seen=clock_timestamp(),draining=false`
    if(runtimeState.draining)return
    if(options.role!=='api'){
      history=new HistoryMaintenance();history.start()
      worker=new MonitorWorker(options);worker.start();dispatcher=new NotificationDispatcher(options);dispatcher.start()
      let cleaning=false;cleanup=setInterval(async()=>{if(cleaning||runtimeState.draining)return;cleaning=true;try{await cleanupRuntime()}catch{}finally{cleaning=false}},60000);cleanup.unref()
    }
    if(options.role!=='worker'){bridge=new StateBridge();bridge.start()}
    runtimeState.databaseHealthy=true;runtimeState.ready=true;retryMs=1000
    let updating=false
    heartbeat=setInterval(async()=>{
      if(updating||runtimeState.draining)return;updating=true
      try{const metrics=JSON.stringify({...identity,...worker?.status(),notifications:dispatcher?.status(),bridge:bridge?.metrics,memory:process.memoryUsage(),role:options.role});await prisma.$executeRaw`UPDATE worker_instances SET last_seen=clock_timestamp(),inflight=${worker?.active.size||0},metrics=${metrics}::jsonb WHERE instance_id=${workerInstanceId}::uuid`;runtimeState.databaseHealthy=true}
      catch{runtimeState.databaseHealthy=false}
      finally{updating=false}
    },5000);heartbeat.unref()
  })()
  starting=attempt
  attempt.catch(error=>{
    runtimeState.initializationFailures++
    if(transientDatabaseError(error)&&!runtimeState.draining){starting=undefined;retry=setTimeout(()=>{retry=undefined;void initializeRuntime().catch(()=>{})},retryMs);retry.unref();retryMs=Math.min(30000,retryMs*2)}
  })
  return attempt
}
export function drainRuntime(){
  if(draining)return draining
  runtimeState.draining=true;runtimeState.ready=false
  if(heartbeat)clearInterval(heartbeat);if(retry)clearTimeout(retry);if(cleanup)clearInterval(cleanup)
  return draining=(async()=>{
    runtimeState.drainPhase='stopping'
    await Promise.allSettled([worker?.stop(),dispatcher?.stop(),bridge?.stop(),history?.stop()])
    runtimeState.drainPhase='registry'
    try{await prisma.$queryRaw`UPDATE worker_instances SET draining=true,inflight=0,last_seen=clock_timestamp() WHERE instance_id=${workerInstanceId}::uuid RETURNING instance_id`}catch{}
    runtimeState.drainPhase='complete'
    console.info('[Runtime] Drained')
  })()
}
export function wakeRuntime(monitorId?:number){if(monitorId)worker?.abort(monitorId);void worker?.poll()}
