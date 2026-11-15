/** Runtime lease fields are server-owned and must never be cloned as configuration. */
export const monitorLeaseFields=['nextCheckAt','runId','scheduledFor','leaseOwner','leaseToken','leaseUntil','claimedConfigVersion','originHint'] as const
export function withoutMonitorLease(row:any){const result={...row};for(const key of monitorLeaseFields)delete result[key];delete result.tlsInfo;delete result.states;delete result.notificationOutbox;return result}
export async function databaseNow(tx:any):Promise<Date>{const rows=await tx.$queryRaw`SELECT clock_timestamp() AS now`;return rows[0].now}
export function initialMonitorSchedule(id:number,interval:number,now:Date){
  const seconds=Math.max(1,interval||60),jitter=Number((BigInt(id)*2654435761n)%BigInt(seconds))
  return {originHint:null,nextCheckAt:new Date(now.getTime()+jitter*1000),runId:null,scheduledFor:null,leaseOwner:null,leaseUntil:null,claimedConfigVersion:null}
}
export async function fenceEnvironment(tx:any,workspaceId:number,environmentId:number){
  // Native update on each monitor row shares the same lock as claim/completion.
  await tx.$executeRaw`UPDATE monitors SET origin_hint=NULL,tls_info=NULL,config_version=config_version+1,run_id=NULL,scheduled_for=NULL,lease_owner=NULL,lease_until=NULL,claimed_config_version=NULL,next_check_at=clock_timestamp()+make_interval(secs=>((id::bigint*2654435761)%GREATEST(interval,1))::double precision) WHERE workspace_id=${workspaceId} AND environment_id=${environmentId}`
}
export async function fenceMonitorData(tx:any,monitor:any,input:any){
 const now=await databaseNow(tx)
 if(monitor.active&&input.active===false){
  const state=await tx.monitorState.findUnique({where:{monitorId:monitor.id}})
  if(state){
   const beat=await tx.heartbeat.create({data:{monitorId:monitor.id,time:now,status:2,ping:0,msg:'Paused',checkCode:'PAUSED',coverageSeconds:0,important:false}})
   const {Prisma}=await import('@prisma/client')
   await tx.monitorState.update({where:{monitorId:monitor.id},data:{heartbeatId:beat.id,status:2,ping:0,checkCode:'PAUSED',checkedAt:now,statusChangedAt:now,assertionResults:Prisma.DbNull,revision:{increment:1}}})
   await tx.$executeRaw`SELECT pg_notify('uptime_monitor_state',${String(monitor.id)})`
  }
 }
 const {Prisma}=await import('@prisma/client')
 return {...input,tlsInfo:Prisma.DbNull,...initialMonitorSchedule(monitor.id,input.interval??monitor.interval,now),configVersion:{increment:1}}
}
export async function fenceMonitorIds(tx:any,workspaceId:number,ids:number[]){
  if(!ids.length)return
  const {Prisma}=await import('@prisma/client')
  const unique=[...new Set(ids)].sort((a,b)=>a-b)
  await tx.$queryRaw(Prisma.sql`SELECT id FROM monitors WHERE workspace_id=${workspaceId} AND id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`)
  await tx.$executeRaw(Prisma.sql`UPDATE monitors SET origin_hint=NULL,tls_info=NULL,config_version=config_version+1,run_id=NULL,scheduled_for=NULL,lease_owner=NULL,lease_until=NULL,claimed_config_version=NULL,next_check_at=clock_timestamp() WHERE workspace_id=${workspaceId} AND id IN (${Prisma.join(unique)})`)
}
