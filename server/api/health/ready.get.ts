import {workerPrisma as prisma} from '../../utils/worker-prisma'
import {runtimeState} from '../../services/monitor/runtime'
import {runtimeOptions} from '../../services/monitor/runtime-config'
export default defineEventHandler(async()=>{
  if(!runtimeState.ready||runtimeState.draining)throw createError({statusCode:503,message:'Runtime not ready'})
  try{await prisma.$queryRaw`SELECT 1`}catch{throw createError({statusCode:503,message:'Database unavailable'})}
  return {status:'ready',role:runtimeOptions().role}
})
