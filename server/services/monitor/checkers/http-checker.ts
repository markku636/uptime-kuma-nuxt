import type { CheckResult } from '../checker'
import type { TLSInfo } from './tls-checker'
import { executeHttpRequest, HttpCheckError } from './http-request'
import { resolveMonitorConfig } from '../../../utils/monitor-config'
import { assertionsSchema, evaluateAssertions } from '../../../utils/assertions'
import type { AssertionEvaluation } from '../../../../shared/types/assertions'
export interface HttpCheckResult extends CheckResult { tlsInfo?:TLSInfo|null }
const empty={version:1,mode:'all',rules:[]} as const
const messages:Record<string,string>={TIMEOUT:'Request deadline exceeded',DESTINATION_DENIED:'Destination is not permitted',RESPONSE_TOO_LARGE:'Response exceeds the byte limit',REQUEST_TOO_LARGE:'Request exceeds the byte limit',INVALID_RESPONSE:'Invalid HTTP response',CONFIG_ERROR:'Invalid or unsupported monitor configuration',NETWORK_ERROR:'Network request failed',AUTH_ERROR:'Authentication request failed',REDIRECT_LIMIT:'Redirect limit exceeded',INVALID_JSON:'Response is not valid bounded JSON',HTTP_STATUS:'HTTP status was not accepted',ASSERTIONS_FAILED:'Response assertions failed',KEYWORD_MISMATCH:'Keyword condition failed',JSON_QUERY_MISMATCH:'JSON query condition failed'}
function acceptedStatus(status:number,input:unknown){
  if(input===null||input===undefined||Array.isArray(input)&&!input.length)return status>=200&&status<400
  if(!Array.isArray(input))throw new HttpCheckError('CONFIG_ERROR')
  const ranges=input.map(value=>{
    const match=/^(\d{3})(?:-(\d{3}))?$/.exec(String(value))
    if(!match)throw new HttpCheckError('CONFIG_ERROR')
    const min=Number(match[1]),max=Number(match[2]||match[1]);if(min<100||max>599||min>max)throw new HttpCheckError('CONFIG_ERROR')
    return {min,max}
  })
  return ranges.some(({min,max})=>status>=min&&status<=max)
}
function legacyExpected(value:string){try{return JSON.parse(value)}catch{return value}}
export async function checkHttp(monitor:any,startTime:number,externalSignal?:AbortSignal):Promise<HttpCheckResult>{
  const timeout=Number(monitor.timeout||48)
  if(!Number.isFinite(timeout)||timeout<0.05||timeout>120)return {status:0,ping:0,msg:messages.CONFIG_ERROR!,code:'CONFIG_ERROR'}
  const deadline=AbortSignal.timeout(Math.max(1,Math.ceil(startTime+timeout*1000-Date.now())))
  const signal=externalSignal?AbortSignal.any([deadline,externalSignal]):deadline
  try{
    const config=await resolveMonitorConfig(monitor,signal)
    const parsed=assertionsSchema.safeParse(config.assertions??empty)
    if(!parsed.success)throw new HttpCheckError('CONFIG_ERROR')
    const response=await executeHttpRequest(config,startTime,signal)
    let evaluation=evaluateAssertions(parsed.data,response)
    if(evaluation.error)return {status:0,ping:Date.now()-startTime,msg:messages[evaluation.error]!,code:evaluation.error,assertionResults:evaluation}
    let passed=evaluation.passed,code=passed?'CHECK_OK':'ASSERTIONS_FAILED'
    if(!parsed.data.rules.some(rule=>rule.source==='status')&&!acceptedStatus(response.status,config.acceptedStatuscodes)){passed=false;code='HTTP_STATUS'}
    if(config.type==='keyword'&&!config.keyword)throw new HttpCheckError('CONFIG_ERROR')
    if(config.keyword){const found=response.body.includes(config.keyword);if(config.invertKeyword?found:!found){passed=false;code='KEYWORD_MISMATCH'}}
    if(config.type==='json-query'){
      const expected=config.expectedValue
      const legacy=evaluateAssertions({version:1,mode:'all',rules:[{id:'json-query',source:'json',path:config.jsonPath,
        operator:expected===undefined||expected===null||expected===''?'exists':config.invertKeyword?'notEquals':'equals',
        ...(expected!==undefined&&expected!==null&&expected!==''?{expected:legacyExpected(String(expected))}:{})}]},response)
      if(legacy.error)return {status:0,ping:Date.now()-startTime,msg:messages[legacy.error]!,code:legacy.error,assertionResults:legacy}
      evaluation={passed:evaluation.passed&&legacy.passed,rules:[...evaluation.rules,...legacy.rules.map(rule=>({...rule,ruleId:'legacy:'+rule.ruleId}))]}
      if(!legacy.passed){passed=false;code='JSON_QUERY_MISMATCH'}
    }
    const up=config.upsideDown?!passed:passed
    return {status:up?1:0,ping:Date.now()-startTime,msg:up?(config.upsideDown?'Check passed (inverted)':'Check passed'):messages[code]||'Check failed',
      code:up?'CHECK_OK':code,assertionResults:evaluation,tlsInfo:response.tlsInfo}
  }catch(error){
    const code=signal.aborted?'TIMEOUT':error instanceof HttpCheckError?error.code:'CONFIG_ERROR'
    return {status:0,ping:Date.now()-startTime,msg:messages[code]||'Check failed',code}
  }
}
export async function checkKeyword(monitor:any,start:number,signal?:AbortSignal){return checkHttp({...monitor,type:'keyword'},start,signal)}
