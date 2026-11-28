import { checkMonitor } from '../services/monitor/checker'
const active=new Set<number>(), windows=new Map<number,{time:number,count:number}>()
let total=0
/** Trials share the actual checker, but never write history or dispatch notifications.
 *  The optional checker argument exists only so unit tests can inject a recorder. */
export async function trialMonitor(userId:number,monitor:any,checker:typeof checkMonitor=checkMonitor) {
  if(!['http','keyword','json-query','bruno','browser-flow','site-audit'].includes(monitor.type))throw createError({statusCode:400,message:'Trial does not support this monitor type'})
  const now=Date.now(),window=windows.get(userId)
  const current=window&&now-window.time<60000?window:{time:now,count:0}
  if(current.count>=10||active.has(userId)||total>=8)throw createError({statusCode:429,message:'Trial capacity reached; retry shortly'})
  if(windows.size>=10000)for(const [id,row]of windows)if(now-row.time>=60000)windows.delete(id)
  if(windows.size>=10000&&!windows.has(userId))throw createError({statusCode:503,message:'Trial capacity reached'})
  current.count++;windows.set(userId,current);active.add(userId);total++
  try {
    const result=await checker({...monitor, includeTrialResponse:true})
    return {ok:true,data:{status:result.status,ping:result.ping,code:result.code||'CHECK_COMPLETE',
      msg:result.status===1?'Check passed':'Check failed',
      ...(String(result.code||'').startsWith('FLOW')?{detail:result.msg}:{}),
      assertionResults:result.assertionResults,
      ...(result.flowSteps?{flowSteps:result.flowSteps}:{}),
      ...(result.response?{response:result.response}:{})}}
  }finally{active.delete(userId);total--}
}
