import {Prisma} from '@prisma/client'
import {workerPrisma} from '../../utils/worker-prisma'
export async function claimNotifications(owner:string,limit:number,leaseMs:number,maxAttempts=5,db:any=workerPrisma,excludeIds:bigint[]=[]){
  if(!owner||!Number.isSafeInteger(limit)||limit<1||limit>32)throw new Error('Invalid notification claim')
  return db.$transaction(async(tx:any)=>{
    await tx.$executeRaw(Prisma.sql`WITH exhausted AS (SELECT id FROM notification_outbox WHERE status IN ('pending','processing') AND attempts>=${maxAttempts} AND (lease_until IS NULL OR lease_until<=statement_timestamp()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 50) UPDATE notification_outbox o SET status='dead',completed_at=clock_timestamp(),lease_owner=NULL,lease_until=NULL,error_code='MAX_ATTEMPTS' FROM exhausted e WHERE o.id=e.id`)
    return tx.$queryRaw(Prisma.sql`WITH candidates AS (
      SELECT id FROM notification_outbox WHERE status IN ('pending','processing') AND attempts<${maxAttempts}
      ${excludeIds.length?Prisma.sql`AND id NOT IN (${Prisma.join(excludeIds)})`:Prisma.empty}
      AND next_attempt_at<=statement_timestamp() AND (lease_until IS NULL OR lease_until<=statement_timestamp())
      ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT ${limit}
    ) UPDATE notification_outbox o SET status='processing',attempts=o.attempts+1,lease_owner=${owner},lease_token=o.lease_token+1,lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond'
    FROM candidates c WHERE o.id=c.id
    RETURNING o.id,o.notification_id AS "notificationId",o.workspace_id AS "workspaceId",o.payload,o.attempts,o.lease_owner AS "leaseOwner",o.lease_token AS "leaseToken",o.lease_until AS "leaseUntil"`)
  })
}
export async function renewNotificationLease(row:any,leaseMs:number,db:any=workerPrisma){
  const result=await db.$executeRaw(Prisma.sql`UPDATE notification_outbox SET lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond' WHERE id=${row.id} AND status='processing' AND lease_owner=${row.leaseOwner} AND lease_token=${row.leaseToken} AND lease_until>clock_timestamp()`)
  return result===1
}
export async function acknowledgeNotification(row:any,status:'delivered'|'dead'|'cancelled'|'pending',code:string|null=null,delayMs=0,db:any=workerPrisma){
  const safe=code&&/^[A-Z0-9_]{1,64}$/.test(code)?code:null
  return (await db.$executeRaw(Prisma.sql`UPDATE notification_outbox SET status=${status},error_code=${safe},lease_owner=NULL,lease_until=NULL,next_attempt_at=clock_timestamp()+${delayMs}*interval '1 millisecond',completed_at=${status==='pending'?Prisma.sql`NULL`:Prisma.sql`clock_timestamp()`} WHERE id=${row.id} AND status='processing' AND lease_owner=${row.leaseOwner} AND lease_token=${row.leaseToken} AND lease_until>clock_timestamp()`))===1
}
