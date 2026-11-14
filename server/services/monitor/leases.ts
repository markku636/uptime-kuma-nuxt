import {Prisma} from '@prisma/client'
import {prisma} from '../../utils/prisma'
export interface MonitorLease {id:number;workspaceId:number;environmentId:number;runId:string;leaseOwner:string;leaseToken:bigint;leaseUntil:Date;claimedConfigVersion:number;configVersion:number;scheduledFor:Date;[key:string]:any}
export async function claimMonitors(owner:string,limit:number,leaseMs:number,db:any=prisma,excludeIds:number[]=[]):Promise<MonitorLease[]>{
  if(!owner||!Number.isSafeInteger(limit)||limit<1||limit>256||!Number.isSafeInteger(leaseMs)||leaseMs<100||leaseMs>120000)throw new Error('Invalid claim options')
  return db.$transaction(async(tx:any)=>{
    const ids=await tx.$queryRaw(Prisma.sql`
      WITH candidates AS (
        SELECT id FROM monitors
        WHERE active AND type IN ('http','keyword','json-query')
          ${excludeIds.length?Prisma.sql`AND id NOT IN (${Prisma.join(excludeIds)})`:Prisma.empty}
          AND next_check_at<=statement_timestamp()
          AND (lease_until IS NULL OR lease_until<=statement_timestamp())
        ORDER BY next_check_at,id FOR UPDATE SKIP LOCKED LIMIT ${limit}
      )
      UPDATE monitors m SET run_id=COALESCE(m.run_id,gen_random_uuid()),
        scheduled_for=COALESCE(m.scheduled_for,m.next_check_at),lease_owner=${owner},lease_token=m.lease_token+1,
        lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond',claimed_config_version=m.config_version
      FROM candidates c WHERE m.id=c.id RETURNING m.id`)
    if(!ids.length)return []
    return tx.monitor.findMany({where:{id:{in:ids.map((row:any)=>row.id)}},orderBy:{id:'asc'}})
  },{timeout:10000,maxWait:5000})
}
export async function renewMonitorLease(lease:MonitorLease,leaseMs:number,db:any=prisma):Promise<boolean>{
  const rows=await db.$queryRaw(Prisma.sql`UPDATE monitors SET lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond'
    WHERE id=${lease.id} AND workspace_id=${lease.workspaceId} AND environment_id=${lease.environmentId}
      AND active AND run_id=${lease.runId}::uuid AND lease_owner=${lease.leaseOwner} AND lease_token=${lease.leaseToken}
      AND config_version=${lease.configVersion} AND claimed_config_version=${lease.configVersion} AND lease_until>clock_timestamp()
    RETURNING id`)
  return rows.length===1
}
/** Release only after underlying I/O has terminated; keep run identity for crash/retry reclaim. */
export async function relinquishMonitorLease(lease:MonitorLease,db:any=prisma){
  return db.$executeRaw(Prisma.sql`UPDATE monitors SET lease_until=clock_timestamp(),lease_owner=NULL WHERE id=${lease.id} AND run_id=${lease.runId}::uuid AND lease_owner=${lease.leaseOwner} AND lease_token=${lease.leaseToken}`)
}
/** No I/O started: defer a saturated origin without occupying a hidden promise queue. */
export async function deferMonitorLease(lease:MonitorLease,delayMs:number,db:any=prisma){
  return db.$executeRaw(Prisma.sql`UPDATE monitors SET lease_until=NULL,lease_owner=NULL,next_check_at=clock_timestamp()+${delayMs}*interval '1 millisecond' WHERE id=${lease.id} AND run_id=${lease.runId}::uuid AND lease_owner=${lease.leaseOwner} AND lease_token=${lease.leaseToken} AND config_version=${lease.configVersion}`)
}
