import {securityReady} from '../utils/security-bootstrap'
import {runtimeOptions} from '../services/monitor/runtime-config'
import {runtimeState} from '../services/monitor/runtime'
const probes=new Set(['/api/health','/api/v1/health','/api/health/live','/api/health/ready'])
export default defineEventHandler(async event=>{
  const path=getRequestURL(event).pathname
  if(runtimeOptions().role==='worker'&&!probes.has(path))throw createError({statusCode:404,message:'Worker endpoint not available'})
  if(!path.startsWith('/api/')||path==='/api/health/live')return
  try{await securityReady()}catch{throw createError({statusCode:503,message:'Security bootstrap unavailable'})}
  if(!runtimeState.ready||runtimeState.draining||!runtimeState.databaseHealthy&&!probes.has(path))throw createError({statusCode:503,message:'Runtime not ready'})
})
