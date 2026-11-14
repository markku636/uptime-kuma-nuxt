import {randomUUID} from 'node:crypto'
import {Prisma} from '@prisma/client'
import {commitMonitorResult} from '../../services/monitor/commit-result'
export default defineEventHandler(async event=>{
  if(!['GET','POST'].includes(event.method))throw createError({statusCode:405,message:'Method not allowed'})
  const token=getRouterParam(event,'token'),query=getQuery(event)
  if(!token||token.length>128)throw createError({statusCode:404,message:'Monitor not found'})
  if(query.status!==undefined&&!['up','down','pending'].includes(String(query.status)))throw createError({statusCode:400,message:'Invalid push status'})
  const status=query.status==='down'?0:query.status==='pending'?2:1,ping=query.ping===undefined?0:Number(query.ping)
  if(!Number.isFinite(ping)||ping<0||ping>300000)throw createError({statusCode:400,message:'Invalid push timing'})
  return prisma.$transaction(async tx=>{
    const rows=await tx.$queryRaw<{id:number}[]>`SELECT id FROM monitors WHERE push_token=${token} AND type='push' FOR UPDATE`
    if(!rows.length)throw createError({statusCode:404,message:'Monitor not found'})
    const monitor=await tx.monitor.findUniqueOrThrow({where:{id:rows[0]!.id}})
    if(!monitor.active)return {ok:true,msg:'Monitor is paused'}
    const now=(await tx.$queryRaw<{now:Date}[]>`SELECT clock_timestamp() AS now`)[0]!.now
    await commitMonitorResult(tx,{...monitor,runId:randomUUID(),scheduledFor:now},{status,ping:Math.round(ping),msg:'Push received',code:'PUSH_RECEIVED'})
    await tx.$executeRaw(Prisma.sql`SELECT pg_notify('uptime_monitor_state',${String(monitor.id)})`)
    return {ok:true,msg:'Heartbeat received'}
  })
})
