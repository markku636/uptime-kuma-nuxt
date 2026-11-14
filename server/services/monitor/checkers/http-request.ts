import http, { validateHeaderName, validateHeaderValue, type IncomingMessage } from 'node:http'
import https from 'node:https'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib'
import type { Readable, Transform } from 'node:stream'
import type { TLSSocket } from 'node:tls'
import type { TLSInfo } from './tls-checker'
import { parseSafeJson } from '../../../utils/assertions'

export type HttpFailureCode='TIMEOUT'|'DESTINATION_DENIED'|'RESPONSE_TOO_LARGE'|'REQUEST_TOO_LARGE'|'INVALID_RESPONSE'|'CONFIG_ERROR'|'NETWORK_ERROR'|'AUTH_ERROR'|'REDIRECT_LIMIT'
export class HttpCheckError extends Error { constructor(public code:HttpFailureCode){super(code);this.name='HttpCheckError'} }
const poolOptions={keepAlive:true,maxSockets:16,maxTotalSockets:256,maxFreeSockets:8,timeout:60_000}
const httpAgent=new http.Agent(poolOptions),httpsAgent=new https.Agent(poolOptions),insecureAgent=new https.Agent({...poolOptions,rejectUnauthorized:false})
export const MAX_RESPONSE_BYTES=1_048_576
const metadataHosts=new Set(['metadata.google.internal','metadata.google','instance-data.ec2.internal','metadata.azure.internal'])
function normalizedIP(ip:string){if(isIP(ip)===6){try{return new URL(`http://[${ip}]/`).hostname.slice(1,-1)}catch{}}return ip}
export function isForbiddenAddress(input:string,allowPrivate=process.env.HTTP_ALLOW_PRIVATE!=='false'):boolean{
  const ip=normalizedIP(input).toLowerCase()
  const mapped=/^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(ip)
  if(mapped){const a=parseInt(mapped[1]!,16),b=parseInt(mapped[2]!,16);return isForbiddenAddress(`${a>>8}.${a&255}.${b>>8}.${b&255}`,allowPrivate)}
  if(ip.startsWith('::ffff:')&&ip.includes('.'))return isForbiddenAddress(ip.slice(7),allowPrivate)
  if(isIP(ip)===4){
    const [a,b]=ip.split('.').map(Number) as [number,number,number,number]
    if(a===0||a>=224||(a===169&&b===254)||ip==='100.100.100.200')return true
    return !allowPrivate&&(a===127||a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127))
  }
  if(isIP(ip)===6){
    if(ip==='::'||/^fe[89ab]/.test(ip)||ip.startsWith('ff')||['fd00:ec2::254','fd20:ce::254'].includes(ip))return true
    return !allowPrivate&&(ip==='::1'||/^f[cd]/.test(ip)||ip.startsWith('fec'))
  }
  return true
}
function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted)return Promise.reject(new HttpCheckError('TIMEOUT'))
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new HttpCheckError('TIMEOUT'));signal.addEventListener('abort',abort,{once:true})
    promise.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)reject(new HttpCheckError('TIMEOUT'));else resolve(value)},error=>{signal.removeEventListener('abort',abort);reject(error)})
  })
}
export async function resolveDestination(url:URL,signal:AbortSignal){
  if(!['http:','https:'].includes(url.protocol)||url.href.length>8192)throw new HttpCheckError('CONFIG_ERROR')
  const hostname=url.hostname.replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'')
  if(metadataHosts.has(hostname))throw new HttpCheckError('DESTINATION_DENIED')
  const allowlist=(process.env.HTTP_ALLOWED_HOSTS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
  if(allowlist.length&&!allowlist.some(host=>host.startsWith('*.')?hostname.endsWith(host.slice(1))&&hostname!==host.slice(2):hostname===host))throw new HttpCheckError('DESTINATION_DENIED')
  const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await abortable(lookup(hostname,{all:true}),signal)
  if(!addresses.length||addresses.some(({address})=>isForbiddenAddress(address)))throw new HttpCheckError('DESTINATION_DENIED')
  return addresses[0]!
}
export interface HttpRequestResult { status:number; headers:Record<string,string>; body:string; elapsed:number; tlsInfo?:TLSInfo|null }
function certificate(response:IncomingMessage):TLSInfo|null{
  const socket=response.socket as TLSSocket
  if(typeof socket.getPeerCertificate!=='function')return null
  const cert=socket.getPeerCertificate(false);if(!cert?.valid_to)return null
  const from=cert.valid_from?new Date(cert.valid_from):null,to=new Date(cert.valid_to)
  const name=(value:any)=>value?Object.entries(value).map(([k,v])=>`${k}=${v}`).join(', '):''
  return {valid:socket.authorized,issuer:name(cert.issuer),subject:name(cert.subject),validFrom:from,validTo:to,
    daysRemaining:Math.floor((to.getTime()-Date.now())/86_400_000),fingerprint:cert.fingerprint||'',serialNumber:cert.serialNumber||'',
    subjectAltName:cert.subjectaltname?.split(', ').filter(s=>s.startsWith('DNS:')).map(s=>s.slice(4))||[]}
}
function normalizeHeaders(input:unknown):Record<string,string>{
  if(typeof input==='string'){try{input=JSON.parse(input)}catch{throw new HttpCheckError('CONFIG_ERROR')}}
  if(input===null||input===undefined)return {}
  if(typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>100)throw new HttpCheckError('CONFIG_ERROR')
  const headers:Record<string,string>=Object.create(null);let size=0
  for(const [key,value]of Object.entries(input)){
    if(typeof value!=='string'||['host','connection','content-length','transfer-encoding','upgrade','proxy-authorization'].includes(key.toLowerCase()))throw new HttpCheckError('CONFIG_ERROR')
    try{validateHeaderName(key);validateHeaderValue(key,value)}catch{throw new HttpCheckError('CONFIG_ERROR')}
    size+=Buffer.byteLength(key)+Buffer.byteLength(value)+4;if(size>32768)throw new HttpCheckError('REQUEST_TOO_LARGE')
    headers[key.toLowerCase()]=value
  }
  return headers
}
async function rawSingleRequest(url:URL,method:string,headers:Record<string,string>,body:string|undefined,ignoreTls:boolean,signal:AbortSignal,start:number):Promise<HttpRequestResult & {location?:string}>{
  const destination=await resolveDestination(url,signal)
  if(signal.aborted)throw new HttpCheckError('TIMEOUT')
  return new Promise((resolve,reject)=>{
    let complete=false;const streams:Readable[]=[]
    const finish=(error?:Error,result?:HttpRequestResult & {location?:string})=>{
      if(complete)return;complete=true;signal.removeEventListener('abort',abort)
      if(error){request.destroy();for(const stream of streams)stream.destroy();reject(error)}else resolve(result!)
    }
    const request=(url.protocol==='https:'?https:http).request(url,{
      method,headers:body!==undefined?{...headers,'content-length':String(Buffer.byteLength(body))}:headers,agent:url.protocol==='https:'?(ignoreTls?insecureAgent:httpsAgent):httpAgent,
      // Pin a validated DNS address for this connection; redirects repeat validation.
      lookup:((_host:any,options:any,callback:any)=>options?.all?callback(null,[destination]):callback(null,destination.address,destination.family)) as any,
      maxHeaderSize:32768,
    },response=>{
      streams.push(response)
      const responseHeaders=Object.fromEntries(Object.entries(response.headers).filter(([,value])=>value!==undefined).map(([key,value])=>[key,Array.isArray(value)?value.join(', '):String(value)]))
      const tlsInfo=certificate(response),status=response.statusCode||0
      const location=[301,302,303,307,308].includes(status)?response.headers.location:undefined
      let stream:Readable=response
      const encoding=String(response.headers['content-encoding']||'').toLowerCase()
      if(encoding&&encoding!=='identity'){
        if(!['gzip','deflate','br'].includes(encoding)){finish(new HttpCheckError('INVALID_RESPONSE'));return}
        stream=encoding==='gzip'?createGunzip():encoding==='deflate'?createInflate():createBrotliDecompress();streams.push(stream);response.pipe(stream as Transform)
      }
      const chunks:Buffer[]=[];let length=0
      response.once('aborted',()=>finish(new HttpCheckError('NETWORK_ERROR')))
      for(const source of streams)source.once('error',()=>finish(new HttpCheckError('INVALID_RESPONSE')))
      stream.on('data',(chunk:Buffer)=>{length+=chunk.length;if(length>MAX_RESPONSE_BYTES){finish(new HttpCheckError('RESPONSE_TOO_LARGE'));return}chunks.push(chunk)})
      stream.once('end',()=>finish(undefined,{status,headers:responseHeaders,body:Buffer.concat(chunks,length).toString('utf8'),elapsed:Date.now()-start,tlsInfo,...(location?{location}:{})}))
    })
    const abort=()=>finish(new HttpCheckError('TIMEOUT'))
    signal.addEventListener('abort',abort,{once:true})
    request.once('error',()=>finish(new HttpCheckError(signal.aborted?'TIMEOUT':'NETWORK_ERROR')))
    if(signal.aborted){abort();return}
    if(body)request.write(body)
    request.end()
  })
}
const originSlots=new Map<string,{active:number;waiting:{resolve:(release:()=>void)=>void;reject:(error:Error)=>void;signal:AbortSignal;abort:()=>void}[]}>()
function acquireOrigin(origin:string,signal:AbortSignal):Promise<()=>void>{
  const limit=Number(process.env.WORKER_PER_ORIGIN||8)
  if(!Number.isSafeInteger(limit)||limit<1||limit>64)return Promise.reject(new HttpCheckError('CONFIG_ERROR'))
  if(signal.aborted)return Promise.reject(new HttpCheckError('TIMEOUT'))
  let slot=originSlots.get(origin);if(!slot){slot={active:0,waiting:[]};originSlots.set(origin,slot)}
  const release=()=>{
    slot!.active--
    const next=slot!.waiting.shift()
    if(next){next.signal.removeEventListener('abort',next.abort);slot!.active++;next.resolve(release)}
    else if(slot!.active===0)originSlots.delete(origin)
  }
  if(slot.active<limit){slot.active++;return Promise.resolve(release)}
  if(slot.waiting.length>=512)return Promise.reject(new HttpCheckError('CONFIG_ERROR'))
  return new Promise((resolve,reject)=>{
    const waiter={resolve,reject,signal,abort:()=>{const i=slot!.waiting.indexOf(waiter);if(i>=0)slot!.waiting.splice(i,1);reject(new HttpCheckError('TIMEOUT'))}}
    slot!.waiting.push(waiter);signal.addEventListener('abort',waiter.abort,{once:true})
    if(signal.aborted)waiter.abort()
  })
}
async function singleRequest(...args:Parameters<typeof rawSingleRequest>){
  const release=await acquireOrigin(args[0].origin,args[5])
  try{return await rawSingleRequest(...args)}finally{release()}
}
async function follow(urlString:string,method:string,headers:Record<string,string>,body:string|undefined,monitor:any,signal:AbortSignal,start:number):Promise<HttpRequestResult>{
  let url:URL;try{url=new URL(urlString)}catch{throw new HttpCheckError('CONFIG_ERROR')}
  if(url.username||url.password){
    headers.authorization='Basic '+Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64');url.username='';url.password=''
  }
  headers=normalizeHeaders(headers)
  if(body&&Buffer.byteLength(body)>MAX_RESPONSE_BYTES)throw new HttpCheckError('REQUEST_TOO_LARGE')
  const maximum=Number.isInteger(monitor.maxRedirects)?Math.max(0,Math.min(10,monitor.maxRedirects)):10
  for(let redirects=0;;redirects++){
    const response=await singleRequest(url,method,headers,body,!!monitor.ignoreTls,signal,start)
    if(!('location' in response)||maximum===0)return response
    if(redirects>=maximum)throw new HttpCheckError('REDIRECT_LIMIT')
    let next:URL;try{next=new URL(response.location!,url)}catch{throw new HttpCheckError('INVALID_RESPONSE')}
    if(url.protocol==='https:'&&next.protocol==='http:')throw new HttpCheckError('DESTINATION_DENIED')
    if(next.username||next.password)throw new HttpCheckError('DESTINATION_DENIED')
    const becomesGet=(response.status===303&&method!=='HEAD')||(method==='POST'&&[301,302].includes(response.status))
    if(next.origin!==url.origin){
      if(!['GET','HEAD'].includes(method)&&!becomesGet)throw new HttpCheckError('DESTINATION_DENIED')
      headers=Object.fromEntries(Object.entries(headers).filter(([name])=>['accept','accept-encoding','user-agent','content-type'].includes(name)))
    }
    if(becomesGet){method='GET';body=undefined;delete headers['content-type']}
    url=next
  }
}
export async function executeHttpRequest(monitor:any,start=Date.now(),externalSignal?:AbortSignal):Promise<HttpRequestResult>{
  const timeout=Number(monitor.timeout||48)
  if(!Number.isFinite(timeout)||timeout<0.05||timeout>120)throw new HttpCheckError('CONFIG_ERROR')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1,start+timeout*1000-Date.now()));timer.unref()
  const signal=externalSignal?AbortSignal.any([controller.signal,externalSignal]):controller.signal
  try{
    const method=String(monitor.method||'GET').toUpperCase()
    if(!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(method)||monitor.proxyId)throw new HttpCheckError('CONFIG_ERROR')
    const headers=normalizeHeaders(monitor.headers);headers['accept-encoding']||='gzip, deflate, br'
    const body=monitor.body===null||monitor.body===undefined?undefined:String(monitor.body)
    if(body&&Buffer.byteLength(body)>MAX_RESPONSE_BYTES)throw new HttpCheckError('REQUEST_TOO_LARGE')
    if(monitor.authMethod==='basic')headers.authorization='Basic '+Buffer.from(`${monitor.basicAuthUser||''}:${monitor.basicAuthPass||''}`).toString('base64')
    else if(monitor.authMethod==='oauth2-cc'){
      const config=monitor.authConfig||{},tokenUrl=config.tokenUrl||monitor.oauthTokenUrl||monitor.oauth2TokenURL
      if(!tokenUrl)throw new HttpCheckError('CONFIG_ERROR')
      const form=new URLSearchParams({grant_type:'client_credentials',client_id:config.clientId||monitor.oauthClientId||monitor.oauth2ClientId||'',client_secret:config.clientSecret||monitor.oauthClientSecret||monitor.oauth2ClientSecret||''})
      if(config.scopes||monitor.oauthScopes)form.set('scope',config.scopes||monitor.oauthScopes)
      if(config.audience||monitor.oauthAudience)form.set('audience',config.audience||monitor.oauthAudience)
      const token=await follow(tokenUrl,'POST',{'content-type':'application/x-www-form-urlencoded','accept-encoding':'gzip, deflate, br'},form.toString(),{...monitor,ignoreTls:false},signal,start)
      if(token.status<200||token.status>=300)throw new HttpCheckError('AUTH_ERROR')
      let payload:any;try{payload=parseSafeJson(token.body)}catch{throw new HttpCheckError('AUTH_ERROR')}
      if(typeof payload?.access_token!=='string'||payload.access_token.length>8192)throw new HttpCheckError('AUTH_ERROR')
      headers.authorization='Bearer '+payload.access_token
    }else if(monitor.authMethod&&!['none',''].includes(monitor.authMethod))throw new HttpCheckError('CONFIG_ERROR')
    return await follow(String(monitor.url||''),method,headers,body,monitor,signal,start)
  }catch(error){if(error instanceof HttpCheckError)throw error;throw new HttpCheckError(signal.aborted?'TIMEOUT':'NETWORK_ERROR')}
  finally{clearTimeout(timer)}
}
export function closeHttpAgents(){httpAgent.destroy();httpsAgent.destroy();insecureAgent.destroy()}
