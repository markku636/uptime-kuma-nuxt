import { Prisma } from '@prisma/client'
import { decryptSecret, encryptSecret } from './variables'

// Treat the entire outbound request as sensitive, including URLs/query values.
export const sensitiveMonitorFields = ['url','body','headers','basicAuthUser','basicAuthPass','authConfig',
  'grpcUrl','grpcBody','grpcMetadata','databaseConnectionString','databaseQuery','mqttUsername','mqttPassword',
  'kafkaBrokers','kafkaUsername','kafkaPassword','rabbitmqNodes','rabbitmqUsername','rabbitmqPassword',
  'redisConnectionString','radiusSecret','dockerDaemon','dockerHost','queryParams'] as const
const jsonFields = new Set(['headers','authConfig','kafkaBrokers','rabbitmqNodes'])
const context = (monitor:any) => `monitor:${monitor.workspaceId}:${monitor.environmentId}:${monitor.id}`

export function hydrateMonitor(monitor:any) {
  if (!monitor.requestSecrets) return { ...monitor }
  const values = JSON.parse(decryptSecret(monitor.requestSecrets, context(monitor)))
  if (!values || typeof values !== 'object' || Array.isArray(values)
    || Object.keys(values).some(key => !sensitiveMonitorFields.includes(key as any))) throw new Error('Invalid request envelope')
  return { ...monitor, ...values }
}

/** The database never receives a second plaintext copy of a sealed field. */
export function sealMonitor(monitor:any) {
  const hydrated=hydrateMonitor(monitor), values:Record<string,unknown>={}, data:Record<string,any>={}
  for (const key of sensitiveMonitorFields) {
    if (hydrated[key] !== null && hydrated[key] !== undefined) values[key]=hydrated[key]
    if(key!=='queryParams')data[key]=jsonFields.has(key)?Prisma.DbNull:null
  }
  data.requestSecrets=encryptSecret(JSON.stringify(values),context(hydrated))
  return data
}

export function monitorDbInput(input:any) {
  const data={...input,...sealMonitor(input)}
  delete data.queryParams
  return data
}
export function applyMonitorUpdates(existing:any,input:Record<string,any>) {
  const hydrated=hydrateMonitor(existing), { clearSecrets=[], ...updates }=input
  for(const key of clearSecrets)hydrated[key]=null
  return {...hydrated,...updates,requestSecrets:null}
}
export function monitorSecretUpdate(existing:any,input:Record<string,any>) {
  const {clearSecrets,...updates}=input
  const data={...updates,...sealMonitor(applyMonitorUpdates(existing,input))}
  delete data.queryParams
  return data
}

export async function reserveMonitorId(tx:any):Promise<number> {
  const rows=await tx.$queryRawUnsafe(`SELECT nextval(pg_get_serial_sequence('monitors','id'))::integer AS id`)
  return rows[0].id
}

export function monitorEditorDTO(monitor:any) {
  const fields=['id','workspaceId','environmentId','configVersion','name','description','active','userId','interval','retryInterval','maxretries','timeout','responseTimeThreshold','resendInterval','type','hostname','port','method','keyword','invertKeyword','ignoreTls','upsideDown','authMethod','proxyId','weight','createdAt','maxRedirects','acceptedStatuscodes','jsonPath','expectedValue','grpcProtoContent','grpcMethod','grpcServiceName','grpcEnableTls','databaseType','dockerContainer','mqttTopic','mqttSuccessMessage','kafkaTopic','kafkaSaslMechanism','radiusCalledStationId','radiusCallingStationId','game','parent','childrenIds','remoteBrowserId','dnsRecordType','dnsResolver','expiryNotification','tlsExpiryDays','tlsInfo','nodeId','assignedNode','assertions','tags','heartbeats']
  const hydrated=hydrateMonitor(monitor),result:Record<string,any>=Object.fromEntries(fields.filter(key=>Object.hasOwn(monitor,key)).map(key=>[key,monitor[key]])),configuredSecrets:Record<string,boolean>={}
  for (const key of sensitiveMonitorFields) {
    const value=hydrated[key]
    configuredSecrets[key]=value!==null&&value!==undefined&&value!==''&&(!(typeof value==='object')||Object.keys(value).length>0)
    delete result[key]
  }
  delete result.requestSecrets
  delete result.pushToken
  delete result.monitorNotifications
  result.notifications=(monitor.monitorNotifications||[]).map((row:any)=>row.notificationId)
  result.tlsConfigured=typeof hydrated.url==='string'&&hydrated.url.startsWith('https://')
  result.configuredSecrets=configuredSecrets
  result.pushTokenConfigured=!!monitor.pushToken
  result.scheduleSupported=['http','keyword','json-query'].includes(monitor.type)
  result.runtimeStatus=monitor.type==='push'?'push':!monitor.active?'paused':result.scheduleSupported?'scheduled':'unsupported'
  return result
}

export async function backfillMonitorSecrets(db:any) {
  let count=0,after=0
  const fields=sensitiveMonitorFields.filter(key=>key!=='queryParams')
  for(;;){
    const ids=await db.monitor.findMany({where:{id:{gt:after}},orderBy:{id:'asc'},take:100,select:{id:true}})
    if(!ids.length)break
    await db.$transaction(async(tx:any)=>{
      await tx.$queryRaw(Prisma.sql`SELECT id FROM monitors WHERE id IN (${Prisma.join(ids.map((row:any)=>row.id))}) ORDER BY id FOR UPDATE`)
      const rows=await tx.monitor.findMany({where:{id:{in:ids.map((row:any)=>row.id)}}})
      for(const row of rows){
        const hydrated=hydrateMonitor(row)
        const residue=fields.some(key=>row[key]!==null&&row[key]!==undefined)
        if(!row.requestSecrets||residue){
          for(const key of fields)if(row[key]!==null&&row[key]!==undefined)hydrated[key]=row[key]
          await tx.monitor.update({where:{id:row.id},data:sealMonitor({...hydrated,requestSecrets:null})});count++
        }
      }
    },{timeout:30000})
    after=ids.at(-1).id
  }
  return count
}
