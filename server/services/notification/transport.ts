import {positiveSetting} from '../monitor/runtime-config'
import { executeHttpRequest } from '../monitor/checkers/http-request'
/** Providers share the bounded, DNS-pinned, cancelable native transport. Never return response text. */
export async function notificationFetch(url:string,options:any){
  const body=options.body===undefined?undefined:typeof options.body==='string'?options.body:JSON.stringify(options.body)
  const response=await executeHttpRequest({url,method:options.method||'POST',headers:{'content-type':'application/json',...options.headers},body,timeout:positiveSetting('NOTIFICATION_TIMEOUT_MS',10000,100,30000)/1000,maxRedirects:0},Date.now(),options.signal)
  if(response.status<200||response.status>=300)throw new Error('PROVIDER_REJECTED')
  return {ok:true}
}
