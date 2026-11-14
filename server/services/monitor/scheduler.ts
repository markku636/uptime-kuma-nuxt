// Compatibility API: the sole authority is the PostgreSQL lease worker.
import {initializeRuntime,drainRuntime,runtimeWorker,wakeRuntime} from './runtime'
export async function startMonitorJob(monitor:any){wakeRuntime(monitor.id)}
export function stopMonitorJob(monitorId:number){wakeRuntime(monitorId)}
export function stopAllJobs(){void drainRuntime()}
export const initializeScheduler=initializeRuntime
export function getJobStatus(){const worker=runtimeWorker();return {activeJobs:worker?.active.size||0,monitorIds:worker?[...worker.active.keys()]:[],...worker?.status()}}
