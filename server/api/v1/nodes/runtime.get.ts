import {requirePlatformAdmin} from '../../../utils/request-session'
import {runtimeWorker,runtimeDispatcher,runtimeBridge,runtimeState} from '../../../services/monitor/runtime'
import {runtimeOptions,workerInstanceId,supportedScheduledTypes} from '../../../services/monitor/runtime-config'
export default defineEventHandler(async event=>{
  await requirePlatformAdmin(event)
  const [instances,pending,dead,unsupported]=await Promise.all([
    prisma.workerInstance.findMany({orderBy:{lastSeen:'desc'},take:100}),
    prisma.notificationOutbox.count({where:{status:{in:['pending','processing']}}}),prisma.notificationOutbox.count({where:{status:'dead'}}),
    prisma.monitor.groupBy({by:['type'],where:{active:true,type:{notIn:supportedScheduledTypes}},_count:{id:true}}),
  ])
  return {ok:true,data:{instanceId:workerInstanceId,role:runtimeOptions().role,ready:runtimeState.ready&&!runtimeState.draining,draining:runtimeState.draining,
    local:{worker:runtimeWorker()?.status(),notifications:runtimeDispatcher()?.status(),bridge:runtimeBridge()?.metrics},memory:process.memoryUsage(),outbox:{pending,dead},
    supportedScheduledTypes,unsupported:unsupported.map(row=>({type:row.type,count:row._count.id})),
    instances:instances.map(row=>({instanceId:row.instanceId,role:row.role,startedAt:row.startedAt,lastSeen:row.lastSeen,draining:row.draining,inflight:row.inflight,concurrency:row.concurrency,metrics:row.metrics,state:row.draining?'draining':Date.now()-row.lastSeen.getTime()>30000?'offline':'running',effectiveConcurrency:!row.draining&&Date.now()-row.lastSeen.getTime()<=30000?row.concurrency:0}))}}
})
