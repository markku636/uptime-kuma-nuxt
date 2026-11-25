import {decryptSecret} from './variables'
import { hashApiKey } from './request-session'
import { workerPrisma as prisma } from './worker-prisma'
import { backfillResourceSecrets } from './resource-secrets'
import { backfillMonitorSecrets } from './monitor-secrets'
let ready:Promise<void>|undefined
export function securityReady(){
  if(ready)return ready
  const pending=(async()=>{
    const resourceCount=await backfillResourceSecrets(prisma)
    if(resourceCount)console.info(`[Security] Sealed ${resourceCount} legacy resource configurations`)
    const count=await backfillMonitorSecrets(prisma)
    if(count)console.info(`[Security] Sealed ${count} legacy monitor configurations`)
    let after=0
    for(;;){
      const environments=await prisma.environment.findMany({where:{id:{gt:after}},orderBy:{id:'asc'},take:100,select:{id:true,workspaceId:true,secrets:true}})
      if(!environments.length)break
      for(const environment of environments){
        const values=environment.secrets
        if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Invalid environment envelope')
        for(const [name,value]of Object.entries(values)){if(typeof value!=='string')throw new Error('Invalid environment envelope');decryptSecret(value,`${environment.workspaceId}:${environment.id}:${name}`)}
      }
      after=environments.at(-1)!.id
    }
    const legacyKeys=await prisma.apiKey.findMany({where:{key:{startsWith:'uk_'}},select:{id:true,key:true}})
    for(const key of legacyKeys)await prisma.apiKey.updateMany({where:{id:key.id,key:key.key},data:{key:hashApiKey(key.key)}})
  })()
  ready=pending
  pending.catch(error=>{
    if(ready!==pending)return
    ready=undefined
    // A reboot can start the app before PostgreSQL is accepting connections.
    // Retry any bootstrap failure so readiness recovers once the database is up.
    console.warn('[Security] Bootstrap failed, retrying:',error?.code||error?.message)
    const timer=setTimeout(()=>{void securityReady().catch(()=>{})},2000)
    timer.unref()
  })
  return pending
}
