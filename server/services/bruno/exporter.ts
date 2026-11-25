import type {AssertionRule} from '../../../shared/types/assertions'
import {hydrateMonitor} from '../../utils/monitor-secrets'
import {assertionsSchema,parseSelector} from '../../utils/assertions'
export class BrunoExportError extends Error{constructor(public monitorId:number,public code:string){super(code)}}
function line(value:string,id:number){if(/[\r\n]/.test(value))throw new BrunoExportError(id,'MULTILINE_METADATA');return value}
/** Bruno `assert` entry for a typed rule, e.g. {name:'res.status',value:'eq 200'}. */
export function assertionPair(rule:AssertionRule){
  const operators:Record<string,string>={equals:'eq',notEquals:'ne',contains:'contains',notContains:'notContains',gt:'gt',gte:'gte',lt:'lt',lte:'lte',exists:'exists',notExists:'notExists',isNull:'isNull',isNotNull:'isNotNull'}
  const name=rule.source==='status'?'res.status':rule.source==='responseTime'?'res.responseTime':rule.source==='text'?'res.text':rule.source==='header'?`res.headers[${JSON.stringify(rule.path)}]`:'res.body'+rule.path!.slice(1)
  return {name,value:`${operators[rule.operator]}${rule.expected!==undefined?' '+JSON.stringify(rule.expected):''}`}
}
function assertion(rule:AssertionRule){const pair=assertionPair(rule);return `  ${pair.name}: ${pair.value}`}
/** Typed assertions plus legacy keyword / JSON query / status code settings, as Bruno can express them. */
export function monitorAssertionRules(monitor:any,fail:(code:string)=>never):AssertionRule[]{
  const parsed=assertionsSchema.safeParse(monitor.assertions||{version:1,mode:'all',rules:[]})
  if(!parsed.success)fail('INVALID_ASSERTIONS')
  if(parsed.data.mode==='any'&&parsed.data.rules.length>1)fail('ANY_ASSERTIONS_UNSUPPORTED')
  const rules:AssertionRule[]=[...parsed.data.rules] as AssertionRule[]
  if(monitor.keyword)rules.push({id:'legacy-keyword',source:'text',operator:monitor.invertKeyword?'notContains':'contains',expected:monitor.keyword})
  if(monitor.type==='json-query'){
    try{parseSelector(monitor.jsonPath)}catch{fail('UNSUPPORTED_LEGACY_SELECTOR')}
    let expected:any=monitor.expectedValue
    if(expected!==null&&expected!==undefined&&expected!==''){try{expected=JSON.parse(expected)}catch{}}
    rules.push({id:'legacy-json',source:'json',path:monitor.jsonPath,operator:expected===null||expected===undefined||expected===''?'exists':monitor.invertKeyword?'notEquals':'equals',...(expected!==null&&expected!==undefined&&expected!==''?{expected}:{})})
  }
  if(!rules.some(rule=>rule.source==='status')&&monitor.acceptedStatuscodes?.length){
    if(!Array.isArray(monitor.acceptedStatuscodes)||monitor.acceptedStatuscodes.length!==1)fail('MULTIPLE_STATUS_RANGES_UNSUPPORTED')
    const match=/^(\d{3})(?:-(\d{3}))?$/.exec(String(monitor.acceptedStatuscodes[0]));if(!match)fail('UNSUPPORTED_STATUS_RANGE')
    if(match[2])rules.push({id:'status-min',source:'status',operator:'gte',expected:Number(match[1])},{id:'status-max',source:'status',operator:'lte',expected:Number(match[2])})
    else rules.push({id:'status',source:'status',operator:'equals',expected:Number(match[1])})
  }
  if(rules.length>50||!assertionsSchema.safeParse({version:1,mode:'all',rules}).success)fail('UNSUPPORTED_ASSERTIONS')
  return rules
}
/** Placeholder manifest for sharing outside the workspace: every request value becomes a secret placeholder. */
export function exportBrunoMonitors(monitors:any[],collectionId:string){
  const files:{path:string,content:string}[]=[],secretNames:string[]=[]
  for(const stored of monitors){
    const monitor=hydrateMonitor(stored),id=monitor.id
    function fail(code:string):never{throw new BrunoExportError(id,code)}
    if(!['http','keyword','json-query'].includes(monitor.type)||!monitor.url)fail('UNSUPPORTED_OR_INCOMPLETE_MONITOR')
    if(monitor.proxyId||monitor.ignoreTls||monitor.upsideDown||(monitor.maxRedirects??10)!==10||monitor.timeout!==30)fail('UNSUPPORTED_TRANSPORT_SETTINGS')
    const rules=monitorAssertionRules(monitor,fail)
    const placeholder=(field:string)=>{const name=`monitor_${id}_${field}`;secretNames.push(name);return `{{${name}}}`}
    const blocks=[`meta {\n  name: ${line(monitor.name,id)}\n  type: http\n  seq: ${files.length+1}\n}`]
    const auth=monitor.authMethod||'none';if(!['none','','basic'].includes(auth))fail('UNSUPPORTED_AUTH')
    blocks.push(`${monitor.method.toLowerCase()} {\n  url: ${placeholder('url')}\n  body: ${monitor.body?'text':'none'}\n  auth: ${auth==='basic'?'basic':'none'}\n}`)
    if(auth==='basic')blocks.push(`auth:basic {\n  username: ${placeholder('username')}\n  password: ${placeholder('password')}\n}`)
    if(monitor.headers&&Object.keys(monitor.headers).length){
      const headers=Object.keys(monitor.headers).filter(name=>auth!=='basic'||name.toLowerCase()!=='authorization').map((name,index)=>`  ${line(name,id)}: ${placeholder('header_'+index)}`)
      if(headers.length)blocks.push(`headers {\n${headers.join('\n')}\n}`)
    }
    if(monitor.queryParams?.length)blocks.push(`params:query {\n${monitor.queryParams.map((_pair:any,index:number)=>`  ${placeholder('query_name_'+index)}: ${placeholder('query_value_'+index)}`).join('\n')}\n}`)
    if(monitor.body)blocks.push(`body:text {\n  ${placeholder('body')}\n}`)
    if(rules.length)blocks.push(`assert {\n${rules.map(assertion).join('\n')}\n}`)
    files.push({path:`requests/monitor-${id}.bru`,content:blocks.join('\n\n')+'\n'})
  }
  if(secretNames.length>200)throw new BrunoExportError(0,'EXPORT_SECRET_LIMIT')
  files.unshift({path:'bruno.json',content:JSON.stringify({version:'1',name:collectionId,type:'collection',ignore:['node_modules','.git']},null,2)+'\n'})
  files.push({path:'environments/configure.bru',content:`vars:secret [\n${secretNames.map(name=>'  '+name).join(',\n')}\n]\n`})
  return {collectionId,sourceEnvironment:'environments/configure.bru',mode:'create' as const,files,secretNames,
    notice:'Request values are replaced with secret placeholders. Supply them before importing. Headers names and assertion definitions are included; schedules and resource associations are not exported.'}
}
