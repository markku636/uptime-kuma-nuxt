import {workerPrisma} from '../../utils/worker-prisma'
const hour=3600000
export function clearJobDTO(job:any){return {...job,deletedRows:String(job.deletedRows)}}
export async function createClearHistory(workspaceId:number,db:any=workerPrisma,cutoffOverride?:Date){
 return db.$transaction(async(tx:any)=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1420261114,5)::text AS locked`
  const existing=await tx.historyClearJob.findFirst({where:{workspaceId,status:{in:['pending','running']}}});if(existing)return existing
  const [row]=await tx.$queryRaw`SELECT clock_timestamp() AS cutoff,COALESCE(max(id),0)::int AS max_id FROM monitors WHERE workspace_id=${workspaceId}`
  const cutoff=cutoffOverride instanceof Date&&Number.isFinite(cutoffOverride.getTime())?cutoffOverride:row.cutoff
  return tx.historyClearJob.create({data:{workspaceId,cutoff,maxMonitorId:row.max_id}})
 },{timeout:5000,maxWait:2000})
}
/** One bounded transaction per chunk; new observations and self-contained current state survive. */
export async function processClearHistory(db:any=workerPrisma){
 return db.$transaction(async(tx:any)=>{
  const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(1420261114,5) AS acquired`;if(!lock.acquired)return {busy:true}
  const [job]=await tx.$queryRaw`SELECT * FROM history_clear_jobs WHERE status IN ('pending','running') ORDER BY created_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`;if(!job)return {idle:true}
  const [monitor]=await tx.$queryRaw`SELECT id,workspace_id,environment_id FROM monitors WHERE workspace_id=${job.workspace_id} AND id>${job.cursor} AND id<=${job.max_monitor_id} ORDER BY id LIMIT 1 FOR UPDATE`
  if(!monitor){await tx.historyClearJob.update({where:{id:job.id},data:{status:'completed',completedAt:new Date(),currentMonitorId:null}});return {completed:true}}
  if(job.current_monitor_id!==monitor.id){
   const boundary=new Date(Math.floor(job.cutoff.getTime()/hour)*hour)
   await tx.historyCheckpoint.upsert({where:{monitorId:monitor.id},create:{monitorId:monitor.id,workspaceId:monitor.workspace_id,environmentId:monitor.environment_id,firstBucket:boundary,sealedBefore:boundary,rawDeletedBefore:job.cutoff,clearing:true},update:{firstBucket:boundary,sealedBefore:boundary,rawDeletedBefore:job.cutoff,clearing:true,generation:{increment:1}}})
  }
  await tx.$executeRaw`WITH old AS(SELECT bucket_start FROM heartbeat_hourly WHERE monitor_id=${monitor.id} AND bucket_start<${job.cutoff} ORDER BY bucket_start LIMIT 1000) DELETE FROM heartbeat_hourly h USING old o WHERE h.monitor_id=${monitor.id} AND h.bucket_start=o.bucket_start`
  const deleted=await tx.$executeRaw`WITH old AS(SELECT id FROM heartbeats WHERE monitor_id=${monitor.id} AND time<${job.cutoff} ORDER BY time,id LIMIT 1000) DELETE FROM heartbeats h USING old o WHERE h.id=o.id`
  const [remaining]=await tx.$queryRaw`SELECT (EXISTS(SELECT 1 FROM heartbeats WHERE monitor_id=${monitor.id} AND time<${job.cutoff}) OR EXISTS(SELECT 1 FROM heartbeat_hourly WHERE monitor_id=${monitor.id} AND bucket_start<${job.cutoff})) AS yes`
  if(!remaining.yes)await tx.historyCheckpoint.update({where:{monitorId:monitor.id},data:{clearing:false}})
  await tx.historyClearJob.update({where:{id:job.id},data:{status:'running',deletedRows:{increment:BigInt(deleted)},currentMonitorId:remaining.yes?monitor.id:null,...(!remaining.yes?{cursor:monitor.id,processedMonitors:{increment:1}}:{})}})
  return {deleted:Number(deleted),monitorId:monitor.id}
 },{timeout:10000,maxWait:2000})
}
