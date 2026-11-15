import {projectTLSCache} from '../../utils/tls-cache'
import {commitMonitorResult} from './commit-result'
import {Prisma} from '@prisma/client'
import {prisma} from '../../utils/prisma'
import type {CheckResult} from './checker'
import type {MonitorLease} from './leases'
export async function completeMonitorRun(lease:MonitorLease,result:CheckResult,db:any=prisma){
  if(![0,1,2,3].includes(result.status)||!Number.isFinite(result.ping))throw new Error('Invalid check result')
  return db.$transaction(async(tx:any)=>{
    const rows=await tx.$queryRaw(Prisma.sql`SELECT id FROM monitors WHERE id=${lease.id} AND workspace_id=${lease.workspaceId} AND environment_id=${lease.environmentId}
      AND active AND run_id=${lease.runId}::uuid AND lease_owner=${lease.leaseOwner} AND lease_token=${lease.leaseToken}
      AND config_version=${lease.configVersion} AND claimed_config_version=${lease.configVersion} AND lease_until>clock_timestamp() FOR UPDATE`)
    if(!rows.length){const accepted=await tx.heartbeat.findUnique({where:{runId:lease.runId},select:{monitorId:true}});return {accepted:false,replayed:accepted?.monitorId===lease.id}}
    const monitor=await tx.monitor.findUniqueOrThrow({where:{id:lease.id}})
    const {now,heartbeat,state}=await commitMonitorResult(tx,monitor,result)
    const interval=Math.max(1,monitor.interval)*1000,scheduled=lease.scheduledFor.getTime(),next=scheduled+(Math.floor(Math.max(0,now.getTime()-scheduled)/interval)+1)*interval
    const data:any={...((result as any).originHint?{originHint:(result as any).originHint}:{}),nextCheckAt:new Date(next),runId:null,scheduledFor:null,leaseOwner:null,leaseUntil:null,claimedConfigVersion:null}
    if((result as any).tlsInfo)data.tlsInfo=projectTLSCache((result as any).tlsInfo,monitor.configVersion,now)??Prisma.DbNull
    const renewed=await tx.$queryRaw(Prisma.sql`SELECT id FROM monitors WHERE id=${lease.id} AND lease_until>clock_timestamp()` )
    if(!renewed.length)throw new Error('LEASE_EXPIRED_DURING_COMPLETION')
    await tx.monitor.update({where:{id:lease.id},data})
    await tx.$executeRaw(Prisma.sql`SELECT pg_notify('uptime_monitor_state',${String(lease.id)})`)
    return {accepted:true,replayed:false,heartbeat,state}
  },{timeout:10000,maxWait:5000})
}
