import brunoLang from '@usebruno/lang'
import {setImmediate as yieldTurn} from 'node:timers/promises'
import {validateHeaderName,validateHeaderValue} from 'node:http'
import path from 'node:path'
import type {BrunoManifest,BrunoParsed,BrunoIssue} from '../../../shared/types/bruno'
import type {AssertionRule,JsonValue} from '../../../shared/types/assertions'
import {assertionsSchema,parseSafeJson,parseSelector} from '../../utils/assertions'
import {createMonitorSchema} from '../../utils/monitor-input'
import {validVariableName} from '../../utils/variables'
const methods=new Set(['get','head','post','put','patch','delete','options'])
const requestBlocks=new Set(['meta',...methods,'headers','query','params:query','auth:basic','auth:bearer','body:json','body:text','vars:pre-request','assert','docs'])
const scopeBlocks=new Set(['meta','headers','query','auth','auth:basic','auth:bearer','vars:pre-request','docs'])
const envBlocks=new Set(['vars','vars:secret'])
class Unsupported extends Error{constructor(public code:string,public field?:string){super(code)}}
function fail(code:string,field?:string):never{throw new Unsupported(code,field)}
const own=(value:any,key:string)=>Object.hasOwn(value||{},key)
function keys(value:any,allowed:string[],field:string){if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID_FIELD',field);if(Object.keys(value).some(key=>!allowed.includes(key)))fail('UNSUPPORTED_FIELD',field)}
function string(value:any,field:string,maximum=65536):string{if(typeof value!=='string'||Buffer.byteLength(value)>maximum)fail('INVALID_FIELD',field);return value}
export function canonicalBrunoPath(value:string){
  if(value!==value.normalize('NFC')||value.includes('\\')||/[\x00-\x1f\x7f]/.test(value)||value.startsWith('/')||/^[A-Za-z]:/.test(value)||value.split('/').some(part=>!part||part==='.'||part==='..')||path.posix.normalize(value)!==value)fail('INVALID_PATH')
  return value
}
/** Mirrors official newline-delimited tag ends only to reject lossy/duplicate blocks before parsing. */
function scanBlocks(source:string,allowed:Set<string>){
  const blocks:string[]=[];let offset=0
  while(offset<source.length){
    const rest=source.slice(offset),space=/^\s*/.exec(rest)![0];offset+=space.length;if(offset===source.length)break
    const match=/^([A-Za-z][A-Za-z0-9:_-]*)[ \t]*([\[{])/.exec(source.slice(offset))
    if(!match)fail('UNSUPPORTED_SYNTAX')
    const name=match[1]!,open=match[2]!
    if(!allowed.has(name))fail('UNSUPPORTED_BLOCK',name.replace(/[^A-Za-z0-9:_-]/g,'').slice(0,64))
    if(blocks.includes(name))fail('DUPLICATE_BLOCK',name)
    blocks.push(name)
    const bodyStart=offset+match[0].length,end=new RegExp(`\\r?\\n\\${open==='{'?'}':']'}`).exec(source.slice(bodyStart))
    if(!end)fail('INVALID_SYNTAX')
    offset=bodyStart+end.index+end[0].length
  }
  if(blocks.filter(name=>methods.has(name)).length>1)fail('DUPLICATE_HTTP_BLOCK')
  return blocks
}
function variablePairs(value:any,field:string){
  const result:Record<string,string>=Object.create(null)
  if(value===undefined)return result
  if(!Array.isArray(value)||value.length>200)fail('INVALID_VARIABLES',field)
  for(const pair of value){
    keys(pair,['name','value','enabled','secret','local'],'variables')
    if(typeof pair.enabled!=='boolean'||(pair.secret!==undefined&&typeof pair.secret!=='boolean')||(pair.local!==undefined&&typeof pair.local!=='boolean'))fail('INVALID_VARIABLES',field)
    if(!pair.enabled)continue
    if(!validVariableName(pair.name)||own(result,pair.name))fail('INVALID_VARIABLES',field)
    result[pair.name]=string(pair.value,field)
  }
  return result
}
function scopeVars(ast:any){if(ast.vars===undefined)return Object.create(null);keys(ast.vars,['req'],'vars');return variablePairs(ast.vars.req,'vars')}
function strictScope(ast:any){
  keys(ast,['meta','headers','query','auth','vars','docs'],'scope')
  if(ast.meta){keys(ast.meta,['name','type','seq'],'meta');if(ast.meta.type&&ast.meta.type!=='collection')fail('UNSUPPORTED_TYPE','meta.type')}
  scopeVars(ast)
  if(ast.auth){keys(ast.auth,['mode','basic','bearer'],'auth');if(!['none','inherit','basic','bearer'].includes(ast.auth.mode||'none'))fail('UNSUPPORTED_AUTH','auth.mode')}
}
function resolver(primary:Record<string,string>,environment:Record<string,string>,collection:Record<string,string>,preserveEnvironment:boolean,onReference?:(name:string)=>void,opaqueEnvironment=new Set<string>()){
  let operations=0
  const resolve=(source:string,chain:string[]=[]):string=>{
    if(++operations>10000||chain.length>32)fail('VARIABLE_COMPLEXITY','variables')
    const expression=/\{\{\s*([^{}]+?)\s*\}\}/g
    if(/\{\{|\}\}/.test(source.replace(expression,'')))fail('UNSUPPORTED_VARIABLE','variables')
    const result=source.replace(expression,(_match,name)=>{
      onReference?.(name)
      if(!validVariableName(name))fail('UNSUPPORTED_VARIABLE','variables')
      if(chain.includes(name))fail('VARIABLE_CYCLE','variables')
      if(own(primary,name))return resolve(primary[name]!,[...chain,name])
      if(own(environment,name))return preserveEnvironment?`{{${name}}}`:opaqueEnvironment.has(name)?environment[name]!:resolve(environment[name]!,[...chain,name])
      if(own(collection,name))return resolve(collection[name]!,[...chain,name])
      return fail('MISSING_VARIABLE','variables')
    })
    if(Buffer.byteLength(result)>1048576)fail('VARIABLE_EXPANSION_LIMIT','variables')
    return result
  }
  return resolve
}
function pairLayer(pairs:any,field:string){
  if(pairs===undefined)return []
  if(!Array.isArray(pairs)||pairs.length>100)fail('INVALID_PAIRS',field)
  const seen=new Set<string>(),result:{name:string,value:string}[]=[]
  for(const pair of pairs){
    keys(pair,field==='query'?['name','value','enabled','type']:['name','value','enabled'],field)
    if(typeof pair.enabled!=='boolean')fail('INVALID_PAIRS',field)
    if(!pair.enabled)continue
    if(pair.type&&pair.type!=='query')fail('UNSUPPORTED_PARAMETER',field)
    const name=string(pair.name,field,256),value=string(pair.value,field,32768),key=field==='headers'?name.toLowerCase():name
    if(seen.has(key))fail('DUPLICATE_PAIR',field);seen.add(key);result.push({name,value})
  }
  return result
}
function inheritedPairs(layers:any[],field:'headers'|'query'){
  const result=new Map<string,{name:string,value:string}>()
  for(const layer of layers)for(const pair of pairLayer(field==='query'?layer.query||layer.params:layer.headers,field))result.set(field==='headers'?pair.name.toLowerCase():pair.name,pair)
  return [...result.values()]
}
function assertionRules(pairs:any):AssertionRule[]{
  if(pairs===undefined)return []
  if(!Array.isArray(pairs)||pairs.length>20)fail('ASSERTION_LIMIT','assert')
  const result:AssertionRule[]=[]
  for(const pair of pairs){
    keys(pair,['name','value','enabled'],'assert');if(typeof pair.enabled!=='boolean')fail('INVALID_ASSERTION','assert');if(!pair.enabled)continue
    const expression=string(pair.name,'assert',256),value=string(pair.value,'assert',4096),match=/^(eq|ne|neq|gt|gte|lt|lte|contains|notContains|exists|notExists|isNull|isNotNull)(?:\s+([\s\S]+))?$/.exec(value)
    if(!match)fail('UNSUPPORTED_ASSERTION','assert')
    const operators:Record<string,AssertionRule['operator']>={eq:'equals',ne:'notEquals',neq:'notEquals',gt:'gt',gte:'gte',lt:'lt',lte:'lte',contains:'contains',notContains:'notContains',exists:'exists',notExists:'notExists',isNull:'isNull',isNotNull:'isNotNull'}
    const rule:AssertionRule={id:`bruno-${result.length+1}`,source:'json',operator:operators[match[1]!]!}
    if(expression==='res.status')rule.source='status'
    else if(expression==='res.responseTime')rule.source='responseTime'
    else if(expression==='res.text')rule.source='text'
    else if(expression==='res.body'||expression.startsWith('res.body.')||expression.startsWith('res.body[')){rule.path='$'+expression.slice(8);parseSelector(rule.path)}
    else if(expression.startsWith('res.headers')){const parts=parseSelector('$'+expression.slice(11));if(parts.length!==1||typeof parts[0]!=='string')fail('UNSUPPORTED_ASSERTION','assert');rule.source='header';rule.path=parts[0]}
    else fail('UNSUPPORTED_ASSERTION','assert')
    const unary=['exists','notExists','isNull','isNotNull'].includes(rule.operator)
    if(unary&&match[2]!==undefined)fail('UNSUPPORTED_ASSERTION','assert')
    if(!unary){try{rule.expected=parseSafeJson(match[2]||'') as JsonValue}catch{fail('UNSUPPORTED_ASSERTION','assert')}}
    result.push(rule)
  }
  if(!assertionsSchema.safeParse({version:1,mode:'all',rules:result}).success)fail('UNSUPPORTED_ASSERTION','assert')
  return result
}
function buildRequest(file:string,ast:any,layers:any[],environment:Record<string,string>,collection:Record<string,string>){
  keys(ast,['meta','http','headers','params','query','auth','body','vars','assertions','docs'],'request')
  if(ast.meta){keys(ast.meta,['name','type','seq'],'meta');if(ast.meta.type&&ast.meta.type!=='http')fail('UNSUPPORTED_TYPE','meta.type')}
  keys(ast.http,['method','url','body','auth'],'http')
  const method=string(ast.http.method,'http.method',16).toLowerCase();if(!methods.has(method))fail('UNSUPPORTED_METHOD','http.method')
  let primary:Record<string,string>=Object.create(null)
  for(const layer of [...layers.slice(1),ast])primary={...primary,...scopeVars(layer)}
  const retain=resolver(primary,environment,collection,true),actual=resolver(primary,environment,collection,false,undefined,new Set(Object.keys(environment)))
  const url=retain(string(ast.http.url,'http.url',8192));let parsedURL:URL
  try{parsedURL=new URL(actual(ast.http.url))}catch{fail('INVALID_URL','http.url')}
  if(!['http:','https:'].includes(parsedURL!.protocol))fail('UNSUPPORTED_URL','http.url')
  const headers:Record<string,string>={},allLayers=[...layers,ast]
  for(const pair of inheritedPairs(allLayers,'headers')){
    try{validateHeaderName(pair.name);validateHeaderValue(pair.name,actual(pair.value))}catch{fail('INVALID_HEADER','headers')}
    if(['host','connection','content-length','transfer-encoding','upgrade','proxy-authorization'].includes(pair.name.toLowerCase()))fail('UNSUPPORTED_HEADER','headers')
    headers[pair.name.toLowerCase()]=retain(pair.value)
  }
  const queryParams=inheritedPairs(allLayers,'query').map(pair=>({name:retain(pair.name),value:retain(pair.value)}))
  let auth:any={mode:'none'}
  for(const layer of layers)if(layer.auth&&layer.auth.mode&&layer.auth.mode!=='inherit')auth=layer.auth
  const requestAuth=ast.http.auth||'inherit'
  if(ast.auth)keys(ast.auth,['basic','bearer'],'auth')
  if(requestAuth!=='inherit')auth={mode:requestAuth,...ast.auth}
  const config:any={name:ast.meta?.name||path.posix.basename(file,'.bru'),type:'http',url,method:method.toUpperCase(),active:false,interval:60,timeout:30,headers,queryParams,
    assertions:{version:1,mode:'all',rules:assertionRules(ast.assertions)}}
  if(!['none','basic','bearer'].includes(auth.mode))fail('UNSUPPORTED_AUTH','auth')
  if(auth.mode==='basic'){
    if(own(headers,'authorization'))fail('AMBIGUOUS_AUTH','headers')
    keys(auth.basic,['username','password'],'auth.basic');config.authMethod='basic';config.basicAuthUser=retain(string(auth.basic.username,'auth.basic',8192));config.basicAuthPass=retain(string(auth.basic.password,'auth.basic',8192))
  }else if(auth.mode==='bearer'){
    if(own(headers,'authorization'))fail('AMBIGUOUS_AUTH','headers')
    keys(auth.bearer,['token'],'auth.bearer');headers.authorization='Bearer '+retain(string(auth.bearer.token,'auth.bearer',8192))
  }
  const mode=ast.http.body||'none'
  if(ast.body)keys(ast.body,['json','text'],'body')
  if(!['none','json','text'].includes(mode))fail('UNSUPPORTED_BODY','http.body')
  if(mode!=='none'){
    config.body=retain(string(ast.body?.[mode],'body',131072))
    if(mode==='json'){try{parseSafeJson(actual(ast.body[mode]))}catch{fail('INVALID_JSON_BODY','body')}headers['content-type']||='application/json'}
  }
  const parsed=createMonitorSchema.safeParse(config)
  if(!parsed.success)fail('INVALID_MONITOR','request')
  return {path:file,name:parsed.data.name,config:parsed.data}
}
export async function parseBrunoManifest(manifest:BrunoManifest,targetValues:Record<string,string>={},targetSecretNames:string[]=[]):Promise<BrunoParsed>{
  const result:BrunoParsed={requests:[],environments:[],issues:[],variables:{},secrets:{},missingSecrets:[]}
  const started=performance.now(),files=new Map<string,string>(),asts=new Map<string,any>()
  let bytes=0
  const issue=(file:string,error:unknown)=>{if(result.issues.length<100)result.issues.push({file,code:error instanceof Unsupported?error.code:'INVALID_SYNTAX',...(error instanceof Unsupported&&error.field?{field:error.field}:{})})}
  for(const file of manifest.files){
    try{
      const filename=canonicalBrunoPath(file.path)
      if(files.has(filename))fail('DUPLICATE_PATH')
      const size=Buffer.byteLength(file.content);bytes+=size
      if(size>131072)fail('FILE_TOO_LARGE')
      if(bytes>20*1024*1024)fail('MANIFEST_TOO_LARGE')
      if(filename!=='bruno.json'&&!filename.endsWith('.bru'))fail('UNSUPPORTED_FILE')
      if(filename.endsWith('/collection.bru'))fail('NESTED_COLLECTION')
      if(filename.startsWith('environments/')&&!/^environments\/[^/]+\.bru$/.test(filename))fail('UNSUPPORTED_ENVIRONMENT_PATH')
      files.set(filename,file.content)
    }catch(error){issue(file.path,error)}
  }
  if(result.issues.length)return result
  if(files.size>4500){issue('',new Unsupported('FILE_COUNT_LIMIT'));return result}
  for(const [filename,source]of files){
    if(performance.now()-started>10000){issue(filename,new Unsupported('PARSE_BUDGET_EXCEEDED'));break}
    try{
      if(filename==='bruno.json'){
        const metadata=JSON.parse(source);keys(metadata,['name','version','type','ignore'],'bruno.json')
        if(metadata.type&&metadata.type!=='collection')fail('UNSUPPORTED_TYPE','bruno.json')
        if(metadata.ignore&&(!Array.isArray(metadata.ignore)||metadata.ignore.some((value:any)=>typeof value!=='string')))fail('INVALID_FIELD','bruno.json.ignore')
      }else if(filename.startsWith('environments/')){
        scanBlocks(source,envBlocks);const ast=brunoLang.bruToEnvJsonV2(source);keys(ast,['variables'],'environment');variablePairs(ast.variables,'environment');asts.set(filename,ast);result.environments.push(filename)
      }else if(filename==='collection.bru'||path.posix.basename(filename)==='folder.bru'){
        scanBlocks(source,scopeBlocks);const ast=brunoLang.collectionBruToJson(source);strictScope(ast);asts.set(filename,ast)
      }else{
        const blocks=scanBlocks(source,requestBlocks);if(blocks.filter(block=>methods.has(block)).length!==1)fail('HTTP_BLOCK_REQUIRED')
        asts.set(filename,brunoLang.bruToJsonV2(source))
      }
    }catch(error){issue(filename,error)}
    if(result.issues.length>=100)break
    await yieldTurn()
  }
  if(result.issues.length)return result
  const root=asts.get('collection.bru')||{},collection=scopeVars(root)
  try{
    const sourceEnvironment=manifest.sourceEnvironment?asts.get(manifest.sourceEnvironment):undefined
    if(manifest.sourceEnvironment&&!result.environments.includes(manifest.sourceEnvironment))fail('ENVIRONMENT_NOT_FOUND','sourceEnvironment')
    const sourceValues:Record<string,string>={},sourceSecrets=new Set<string>(),reusedOpaque=new Set<string>()
    for(const pair of sourceEnvironment?.variables||[]){
      if(!pair.enabled)continue
      if(pair.secret){
        sourceSecrets.add(pair.name)
        if(pair.value===''){
          const value=manifest.secrets?.[pair.name]??targetValues[pair.name]
          if(value===undefined){result.missingSecrets.push(pair.name);continue}
          sourceValues[pair.name]=value;reusedOpaque.add(pair.name)
        }else sourceValues[pair.name]=pair.value
      }else sourceValues[pair.name]=pair.value
    }
    if(result.missingSecrets.length){issue(manifest.sourceEnvironment!,new Unsupported('MISSING_SECRET','environment'));return result}
    for(const name of Object.keys(manifest.secrets||{}))sourceSecrets.add(name)
    const staged={...sourceValues,...manifest.variables,...manifest.secrets}
    if(Object.keys(staged).length>200||Object.keys(manifest.variables||{}).some(name=>sourceSecrets.has(name)))fail('INVALID_VARIABLES','environment')
    const opaque=new Set([...Object.keys(targetValues).filter(name=>!own(staged,name)||reusedOpaque.has(name)),...Object.keys(manifest.secrets||{})])
    const merged={...targetValues,...staged},knownSecrets=new Set([...targetSecretNames,...sourceSecrets]),environment:Record<string,string>={}
    for(const [name,value]of Object.entries(merged)){
      let tainted=knownSecrets.has(name)
      const normalize=resolver({},merged,collection,false,reference=>{if(knownSecrets.has(reference))tainted=true},opaque)
      environment[name]=opaque.has(name)?value:normalize(value,[name])
      if(own(staged,name)&&!sourceSecrets.has(name)&&tainted)fail('SECRET_TO_STATIC_VARIABLE','environment')
    }
    for(const name of Object.keys(staged))(sourceSecrets.has(name)?result.secrets:result.variables)[name]=environment[name]!
    if(Buffer.byteLength(JSON.stringify({...result.variables,...result.secrets}))>262144)fail('VARIABLE_BYTES_LIMIT','environment')
    for(const [filename,ast]of asts){
      if(filename==='collection.bru'||filename.startsWith('environments/')||path.posix.basename(filename)==='folder.bru')continue
      if(result.requests.length>=4000){issue(filename,new Unsupported('REQUEST_COUNT_LIMIT'));break}
      try{
        const layers:any[]=[root],parts=filename.split('/');parts.pop()
        for(let depth=0;depth<=parts.length;depth++){const folder=[...parts.slice(0,depth),'folder.bru'].join('/');if(asts.has(folder))layers.push(asts.get(folder))}
        result.requests.push(buildRequest(filename,ast,layers,environment,collection))
      }catch(error){issue(filename,error)}
      if(performance.now()-started>10000){issue(filename,new Unsupported('PARSE_BUDGET_EXCEEDED'));break}
      await yieldTurn()
    }
  }catch(error){issue(manifest.sourceEnvironment||'collection.bru',error)}
  if(!result.requests.length&&!result.issues.length)issue('',new Unsupported('NO_REQUESTS'))
  return result
}
