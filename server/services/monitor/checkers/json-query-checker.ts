import { checkHttp } from './http-checker'
export async function checkJsonQuery(monitor:any,start:number,signal?:AbortSignal){return checkHttp({...monitor,type:'json-query'},start,signal)}
