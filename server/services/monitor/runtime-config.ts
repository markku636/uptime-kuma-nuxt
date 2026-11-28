import {randomUUID} from 'node:crypto'
export const workerInstanceId=randomUUID()
export const supportedScheduledTypes=['http','keyword','json-query','bruno','visual-diff','browser-flow']
export function positiveSetting(name:string,fallback:number,min:number,max:number){
  const input=process.env[name],value=input===undefined?fallback:Number(input)
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`Invalid ${name}`)
  return value
}
let cached:ReturnType<typeof readOptions>|undefined
function readOptions(){
  const role=process.env.APP_ROLE||'all'
  if(!['api','worker','all'].includes(role))throw new Error('Invalid APP_ROLE')
  const leaseMs=positiveSetting('WORKER_LEASE_MS',15000,300,120000)
  const renewMs=positiveSetting('WORKER_RENEW_MS',Math.min(3000,Math.floor(leaseMs/3)),50,30000)
  if(renewMs>=leaseMs/2)throw new Error('WORKER_RENEW_MS must be less than half the lease')
  return {role:role as 'api'|'worker'|'all',concurrency:positiveSetting('WORKER_CONCURRENCY',32,1,256),perOrigin:positiveSetting('WORKER_PER_ORIGIN',8,1,64),claimBatch:positiveSetting('WORKER_CLAIM_BATCH',8,1,32),pollMs:positiveSetting('WORKER_POLL_MS',250,25,10000),leaseMs,renewMs,runTimeoutMs:positiveSetting('WORKER_RUN_TIMEOUT_MS',120000,100,300000),drainMs:positiveSetting('WORKER_DRAIN_MS',15000,100,60000),notificationConcurrency:positiveSetting('NOTIFICATION_CONCURRENCY',4,1,32)}
}
export function runtimeOptions(){return cached||=(readOptions())}
