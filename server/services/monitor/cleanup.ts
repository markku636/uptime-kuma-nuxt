import {workerPrisma} from '../../utils/worker-prisma'
export async function cleanupRuntime(db:any=workerPrisma){
  return db.$transaction(async(tx:any)=>{
    const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(1420261114,4) AS acquired`
    if(!lock.acquired)return
    await tx.$executeRaw`WITH expired AS (SELECT id FROM notification_outbox WHERE completed_at<statement_timestamp()-interval '7 days' AND (event_type<>'tls-expiry' OR completed_at<statement_timestamp()-interval '90 days') ORDER BY completed_at,id LIMIT 1000 FOR UPDATE SKIP LOCKED) DELETE FROM notification_outbox o USING expired e WHERE o.id=e.id`
    // Dedupe keys (TLS expiry + hourly response-time alerts) are retained long
    // enough to cover the alert window, then bounded to keep the table small.
    await tx.$executeRaw`DELETE FROM notification_dedupe WHERE key IN (SELECT key FROM notification_dedupe WHERE created_at<statement_timestamp()-interval '90 days' LIMIT 1000)`
    await tx.$executeRaw`WITH expired AS (SELECT instance_id FROM worker_instances WHERE last_seen<statement_timestamp()-interval '7 days' ORDER BY last_seen LIMIT 100) DELETE FROM worker_instances w USING expired e WHERE w.instance_id=e.instance_id`
  })
}
