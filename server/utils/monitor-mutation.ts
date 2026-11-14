/** Runtime lease fields are server-owned and must never be cloned as configuration. */
export const monitorLeaseFields=['nextCheckAt','runId','scheduledFor','leaseOwner','leaseToken','leaseUntil','claimedConfigVersion'] as const
export function withoutMonitorLease(row:any){const result={...row};for(const key of monitorLeaseFields)delete result[key];delete result.states;delete result.notificationOutbox;return result}
export async function databaseNow(tx:any):Promise<Date>{const rows=await tx.$queryRaw`SELECT clock_timestamp() AS now`;return rows[0].now}
export function initialMonitorSchedule(id:number,interval:number,now:Date){
  const seconds=Math.max(1,interval||60),jitter=Number((BigInt(id)*2654435761n)%BigInt(seconds))
  return {nextCheckAt:new Date(now.getTime()+jitter*1000),runId:null,scheduledFor:null,leaseOwner:null,leaseUntil:null,claimedConfigVersion:null}
}
export async function fenceEnvironment(tx:any,workspaceId:number,environmentId:number){
  // Native update on each monitor row shares the same lock as claim/completion.
  await tx.$executeRaw`UPDATE monitors SET config_version=config_version+1,run_id=NULL,scheduled_for=NULL,lease_owner=NULL,lease_until=NULL,claimed_config_version=NULL,next_check_at=clock_timestamp()+make_interval(secs=>((id::bigint*2654435761)%GREATEST(interval,1))::double precision) WHERE workspace_id=${workspaceId} AND environment_id=${environmentId}`
}
export async function fenceMonitorData(tx:any,monitor:any,input:any){return {...input,...initialMonitorSchedule(monitor.id,input.interval??monitor.interval,await databaseNow(tx)),configVersion:{increment:1}}}
export async function fenceMonitorIds(tx:any,workspaceId:number,ids:number[]){
  if(!ids.length)return
  const {Prisma}=await import('@prisma/client')
  const unique=[...new Set(ids)].sort((a,b)=>a-b)
  await tx.$queryRaw(Prisma.sql`SELECT id FROM monitors WHERE workspace_id=${workspaceId} AND id IN (${Prisma.join(unique)}) ORDER BY id FOR UPDATE`)
  await tx.$executeRaw(Prisma.sql`UPDATE monitors SET config_version=config_version+1,run_id=NULL,scheduled_for=NULL,lease_owner=NULL,lease_until=NULL,claimed_config_version=NULL,next_check_at=clock_timestamp() WHERE workspace_id=${workspaceId} AND id IN (${Prisma.join(unique)})`)
}
