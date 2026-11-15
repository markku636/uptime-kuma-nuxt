import {type UptimeResult} from './queries'
import {uptimeWindows} from './rollup-reader'
export type {UptimeResult} from './queries'
export type UptimeByPeriod=Record<'24h'|'7d'|'30d'|'1y',UptimeResult>
export const periodHours={'24h':24,'7d':168,'30d':720,'1y':8760} as const
export async function calculateUptime(monitorId:number,startTime:Date,endTime=new Date()):Promise<UptimeResult>{return (await uptimeWindows([monitorId],[{key:'range',start:startTime,end:endTime}])).get(`${monitorId}:range`)!}
export async function calculateUptimeByPeriod(monitorId:number):Promise<UptimeByPeriod>{
 const end=new Date(),windows=Object.entries(periodHours).map(([key,hours])=>({key,start:new Date(end.getTime()-hours*3600000),end})),values=await uptimeWindows([monitorId],windows)
 return Object.fromEntries(windows.map(window=>[window.key,values.get(`${monitorId}:${window.key}`)])) as UptimeByPeriod
}
export async function getDailyUptimeHistory(monitorId:number,days=90){
 if(!Number.isSafeInteger(days)||days<1||days>365)throw Error('Invalid history range')
 const now=new Date(),midnight=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()),windows=Array.from({length:days},(_,index)=>{const start=new Date(midnight-(days-index-1)*86400000);return {key:start.toISOString().slice(0,10),start,end:new Date(Math.min(start.getTime()+86400000,now.getTime()))}}),values=await uptimeWindows([monitorId],windows)
 return windows.map(window=>({date:window.key,...values.get(`${monitorId}:${window.key}`)!}))
}
