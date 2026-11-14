import {workerPrisma} from '../../utils/worker-prisma'
import {resolveMonitorConfig} from '../../utils/monitor-config'
import type {CheckResult} from './checker'
import {checkHttp} from './checkers/http-checker'
import {claimMonitors,renewMonitorLease,relinquishMonitorLease,deferMonitorLease,type MonitorLease} from './leases'
import {completeMonitorRun} from './completion'
import {runtimeOptions,workerInstanceId} from './runtime-config'
import {isMonitorUnderMaintenance} from '../maintenance/scheduler'
export class MonitorWorker {
  readonly metrics={claimed:0,completed:0,stale:0,leaseLost:0,failures:0,deferred:0,maxInflight:0,maxLagMs:0}
  readonly active=new Map<number,{controller:AbortController;promise:Promise<void>}>()
  private origins=new Map<string,number>();private timer:NodeJS.Timeout|undefined;private polling=false;private draining=false
  constructor(readonly options=runtimeOptions(),readonly db:any=workerPrisma,readonly owner:string=workerInstanceId){}
  start(){this.draining=false;this.timer=setInterval(()=>void this.poll(),this.options.pollMs);this.timer.unref();void this.poll()}
  async poll(){
    if(this.draining||this.polling)return
    const available=Math.min(this.options.claimBatch,this.options.concurrency-this.active.size);if(available<=0)return
    this.polling=true
    try{
      const claimedAt=performance.now()
      const leases=await claimMonitors(this.owner,available,this.options.leaseMs,this.db,[...this.active.keys()])
      for(const lease of leases){
        if(this.draining){await relinquishMonitorLease(lease,this.db);continue}
        const controller=new AbortController()
        // Insert before running so synchronous resolution can never exceed reserved slots.
        const entry={controller,promise:Promise.resolve()};this.active.set(lease.id,entry)
        entry.promise=this.run(lease,controller,claimedAt).finally(()=>{if(this.active.get(lease.id)===entry)this.active.delete(lease.id)})
        this.metrics.claimed++;this.metrics.maxInflight=Math.max(this.metrics.maxInflight,this.active.size)
      }
    }catch{this.metrics.failures++;for(const entry of this.active.values())entry.controller.abort('DATABASE_UNAVAILABLE')}
    finally{this.polling=false}
  }
  private async run(lease:MonitorLease,controller:AbortController,claimedAt:number){
    let origin:string|undefined,renewing=false,lost=false,submitted=false,deferred=false,finished=false,leaseWatchdog:NodeJS.Timeout
    const watchdog=(started:number)=>{
      clearTimeout(leaseWatchdog)
      if(finished||controller.signal.aborted)return
      const remaining=started+this.options.leaseMs-performance.now()-50
      if(remaining<=0){lost=true;this.metrics.leaseLost++;controller.abort('LEASE_EXPIRED');return}
      leaseWatchdog=setTimeout(()=>{lost=true;this.metrics.leaseLost++;controller.abort('LEASE_EXPIRED')},remaining);leaseWatchdog.unref()
    }
    watchdog(claimedAt)
    const start=Date.now(),deadline=setTimeout(()=>controller.abort('RUN_DEADLINE'),this.options.runTimeoutMs);deadline.unref()
    this.metrics.maxLagMs=Math.max(this.metrics.maxLagMs,Math.max(0,start-lease.scheduledFor.getTime()))
    const renew=setInterval(async()=>{
      if(renewing||lost)return;renewing=true
      try{const started=performance.now();if(!await renewMonitorLease(lease,this.options.leaseMs,this.db)){lost=true;this.metrics.leaseLost++;controller.abort('LEASE_LOST')}else if(!lost&&!finished&&!controller.signal.aborted)watchdog(started)}
      catch{if(!finished){lost=true;this.metrics.leaseLost++;controller.abort('DATABASE_UNAVAILABLE')}}
      finally{renewing=false}
    },this.options.renewMs);renew.unref()
    try{
      let monitor:any,result:CheckResult
      if(controller.signal.aborted)return
      try{
        monitor=await resolveMonitorConfig(lease,controller.signal,this.db)
        origin=new URL(monitor.url).origin
        if((this.origins.get(origin)||0)>=this.options.perOrigin){await deferMonitorLease(lease,Math.max(250,this.options.pollMs*2),this.db);this.metrics.deferred++;deferred=true;origin=undefined;return}
        this.origins.set(origin,(this.origins.get(origin)||0)+1)
      }catch{if(controller.signal.aborted)return;result={status:0,ping:Date.now()-start,msg:'Invalid configuration',code:'CONFIG_ERROR'}}
      if(monitor&&origin){
        if(await isMonitorUnderMaintenance(lease.id,lease.workspaceId,this.db))result={status:3,ping:0,msg:'Under maintenance',code:'MAINTENANCE'}
        else{
          const maxRetries=Math.min(10,Math.max(0,lease.maxretries||0));let retry=0
          for(;;){
            if(controller.signal.aborted)return
            result=await checkHttp(monitor,Date.now(),controller.signal)
            if(result.status===1||retry>=maxRetries||controller.signal.aborted)break
            retry++
            const delay=Math.max(100,Math.min(60000,(lease.retryInterval||60)*1000))
            await new Promise<void>(resolve=>{const done=()=>{clearTimeout(timer);controller.signal.removeEventListener('abort',done);resolve()};const timer=setTimeout(done,delay);controller.signal.addEventListener('abort',done,{once:true});if(controller.signal.aborted)done()})
          }
        }
      }
      if(controller.signal.aborted||lost)return
      const completion=await completeMonitorRun(lease,result!,this.db)
      submitted=true
      if(completion.accepted)this.metrics.completed++;else this.metrics.stale++
    }catch{this.metrics.failures++;try{await deferMonitorLease(lease,1000,this.db)}catch{}}
    finally{
      finished=true
      clearTimeout(deadline);clearInterval(renew);clearTimeout(leaseWatchdog!)
      if(!submitted&&!deferred&&!lost&&controller.signal.reason==='RUN_DEADLINE'){
        try{const completion=await completeMonitorRun(lease,{status:0,ping:Date.now()-start,msg:'Request deadline exceeded',code:'TIMEOUT'},this.db);if(completion.accepted)this.metrics.completed++;else this.metrics.stale++}catch{this.metrics.failures++}
      }
      if(origin){const count=(this.origins.get(origin)||1)-1;if(count)this.origins.set(origin,count);else this.origins.delete(origin)}
      // Never release a slot until checkMonitor's actual socket/stream has terminated.
      try{await relinquishMonitorLease(lease,this.db)}catch{}
    }
  }
  async stop(){
    this.draining=true;if(this.timer)clearInterval(this.timer)
    const drain=setTimeout(()=>{for(const entry of this.active.values())entry.controller.abort('SHUTDOWN')},this.options.drainMs);drain.unref()
    try{while(this.polling)await new Promise(r=>setTimeout(r,10));await Promise.allSettled([...this.active.values()].map(entry=>entry.promise))}finally{clearTimeout(drain)}
  }
  abort(id:number){this.active.get(id)?.controller.abort('CONFIG_CHANGED')}
  status(){return {instanceId:this.owner,inflight:this.active.size,limit:this.options.concurrency,draining:this.draining,...this.metrics}}
}
