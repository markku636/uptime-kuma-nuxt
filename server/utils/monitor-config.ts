import { hydrateMonitor } from './monitor-secrets'
import { workerPrisma } from './worker-prisma'
import { decryptSecret, resolveVariables } from './variables'

const resolvedConfig=Symbol('resolved monitor config')
/** Resolve only explicitly configured variables; never fall back to process.env. */
export async function resolveMonitorConfig(monitor:any,signal?:AbortSignal,db=workerPrisma){
  if(monitor[resolvedConfig])return monitor
  monitor=hydrateMonitor(monitor)
  const values:Record<string,string>=Object.create(null)
  if(monitor.workspaceId&&monitor.environmentId){
    const query=db.environment.findFirst({where:{id:monitor.environmentId,workspaceId:monitor.workspaceId}})
    const environment=signal?await new Promise<Awaited<typeof query>>((resolve,reject)=>{
      const abort=()=>reject(new Error('TIMEOUT'));signal.addEventListener('abort',abort,{once:true})
      query.then(value=>{signal.removeEventListener('abort',abort);resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)})
      if(signal.aborted)abort()
    }):await query
    if(!environment)throw new Error('CONFIG_ERROR')
    for(const [name,value]of Object.entries(environment.variables as Record<string,string>))values[name]=value
    for(const [name,value]of Object.entries(environment.secrets as Record<string,string>))values[name]=decryptSecret(value,`${monitor.workspaceId}:${monitor.environmentId}:${name}`)
  }
  const result={...monitor}
  for(const key of ['url','body','basicAuthUser','basicAuthPass','oauthTokenUrl','oauthClientId','oauthClientSecret','oauthScopes','oauthAudience']){
    if(typeof result[key]==='string')result[key]=resolveVariables(result[key],values)
  }
  let headers=result.headers||{}
  if(typeof headers==='string'){try{headers=JSON.parse(headers)}catch{throw new Error('CONFIG_ERROR')}}
  result.headers=Object.fromEntries(Object.entries(headers).map(([name,value])=>{if(typeof value!=='string')throw new Error('CONFIG_ERROR');return [name,resolveVariables(value,values)]}))
  if(result.authConfig)result.authConfig=Object.fromEntries(Object.entries(result.authConfig).map(([name,value])=>{if(typeof value!=='string')throw new Error('CONFIG_ERROR');return [name,resolveVariables(value,values)]}))
  if(result.queryParams?.length){
    const url=new URL(result.url)
    for(const pair of result.queryParams)url.searchParams.append(resolveVariables(pair.name,values),resolveVariables(pair.value,values))
    result.url=url.toString()
  }
  result.requestSecrets=null
  result[resolvedConfig]=true
  return result
}
