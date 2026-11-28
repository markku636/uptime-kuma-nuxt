import {workerPrisma} from '../../utils/worker-prisma'
import {hydrateResource} from '../../utils/resource-secrets'
import {runtimeOptions,workerInstanceId,positiveSetting} from '../monitor/runtime-config'
import {claimNotifications,renewNotificationLease,acknowledgeNotification} from './outbox'
import {sendNotification} from './sender'
export class NotificationDispatcher {
  readonly active=new Map<string,{controller:AbortController;promise:Promise<void>}>()
  readonly metrics={claimed:0,delivered:0,stale:0,failed:0,dead:0,cancelled:0}
  private timer:NodeJS.Timeout|undefined;private polling=false;private draining=false
  readonly leaseMs=positiveSetting('OUTBOX_LEASE_MS',30000,500,120000)
  readonly maxAttempts=positiveSetting('OUTBOX_MAX_ATTEMPTS',5,1,20)
  readonly backoffMs=positiveSetting('OUTBOX_BACKOFF_MS',1000,50,60000)
  constructor(readonly options=runtimeOptions(),readonly db:any=workerPrisma,readonly owner:string=workerInstanceId){}
  start(){this.timer=setInterval(()=>void this.poll(),this.options.pollMs);this.timer.unref();void this.poll()}
  async poll(){
    if(this.draining||this.polling)return
    const available=this.options.notificationConcurrency-this.active.size;if(available<=0)return
    this.polling=true
    try{
      const started=performance.now(),rows=await claimNotifications(this.owner,available,this.leaseMs,this.maxAttempts,this.db,[...this.active.keys()].map(BigInt))
      for(const row of rows){
        if(this.draining)continue // A non-started claim expires naturally; no I/O is dispatched.
        const controller=new AbortController(),entry={controller,promise:Promise.resolve()};this.active.set(String(row.id),entry)
        entry.promise=this.run(row,controller,started).finally(()=>this.active.delete(String(row.id)));this.metrics.claimed++
      }
    }catch{this.metrics.failed++;for(const entry of this.active.values())entry.controller.abort('DATABASE_UNAVAILABLE')}
    finally{this.polling=false}
  }
  private async run(row:any,controller:AbortController,claimedAt:number){
    let finished=false,lost=false,renewing=false,watchdog:NodeJS.Timeout
    const arm=(start:number)=>{
      clearTimeout(watchdog);if(finished||controller.signal.aborted)return
      const remaining=start+this.leaseMs-performance.now()-50
      if(remaining<=0){lost=true;controller.abort('LEASE_EXPIRED');return}
      watchdog=setTimeout(()=>{lost=true;controller.abort('LEASE_EXPIRED')},remaining);watchdog.unref()
    }
    arm(claimedAt)
    const renew=setInterval(async()=>{
      if(renewing||finished||lost)return;renewing=true
      try{const start=performance.now();if(!await renewNotificationLease(row,this.leaseMs,this.db)){if(!finished){lost=true;controller.abort('LEASE_LOST')}}else arm(start)}
      catch{if(!finished){lost=true;controller.abort('DATABASE_UNAVAILABLE')}}finally{renewing=false}
    },Math.min(3000,Math.floor(this.leaseMs/3)));renew.unref()
    try{
      if(controller.signal.aborted)return
      const channel=await this.db.notification.findFirst({where:{id:row.notificationId,workspaceId:row.workspaceId,active:true}})
      if(!channel){if(await acknowledgeNotification(row,'cancelled','CHANNEL_UNAVAILABLE',0,this.db))this.metrics.cancelled++;return}
      const notification=hydrateResource('notification',channel),payload=row.payload
      if(controller.signal.aborted)return
      await sendNotification({type:notification.type,config:notification.config},{id:payload.monitorId,name:payload.name,eventTime:payload.time,certificateDays:payload.certificateDays},{status:payload.status,ping:payload.ping,code:payload.code,msg:typeof payload.detail==='string'&&payload.detail?payload.detail:'State changed',eventType:payload.eventType,threshold:payload.threshold,downMinutes:payload.downMinutes},controller.signal)
      if(!lost&&!controller.signal.aborted){if(await acknowledgeNotification(row,'delivered',null,0,this.db))this.metrics.delivered++;else this.metrics.stale++}
    }catch(error:any){
      if(!lost&&!controller.signal.aborted){
        const code=error?.message==='UNSUPPORTED_PROVIDER'?'UNSUPPORTED_PROVIDER':'PROVIDER_FAILED',dead=code==='UNSUPPORTED_PROVIDER'||row.attempts>=this.maxAttempts
        const delay=Math.min(300000,this.backoffMs*2**Math.min(10,row.attempts-1))+Number(BigInt(row.id)%251n)
        try{if(await acknowledgeNotification(row,dead?'dead':'pending',code,delay,this.db)){if(dead)this.metrics.dead++;else this.metrics.failed++}}catch{this.metrics.failed++}
      }
    }finally{finished=true;clearInterval(renew);clearTimeout(watchdog!)}
  }
  async stop(){
    this.draining=true;if(this.timer)clearInterval(this.timer)
    const timer=setTimeout(()=>{for(const entry of this.active.values())entry.controller.abort('SHUTDOWN')},this.options.drainMs);timer.unref()
    try{while(this.polling)await new Promise(r=>setTimeout(r,10));await Promise.allSettled([...this.active.values()].map(entry=>entry.promise))}finally{clearTimeout(timer)}
  }
  status(){return {inflight:this.active.size,limit:this.options.notificationConcurrency,...this.metrics}}
}
