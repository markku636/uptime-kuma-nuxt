import { z } from 'zod'
import { isDeepStrictEqual } from 'node:util'
import { assertionSources, assertionOperators, type AssertionSet, type AssertionRule, type AssertionEvaluation, type AssertionRuleResult, type JsonValue } from '../../shared/types/assertions'
const blocked = new Set(['__proto__','prototype','constructor'])

/** Deliberately small non-evaluating JSON selector grammar. */
export function parseSelector(path:string): (string|number)[] {
  if (typeof path!=='string' || path.length>256 || path[0]!=='$') throw new Error('Unsupported JSON selector')
  const tokens:(string|number)[]=[]; let i=1
  while(i<path.length){
    if(tokens.length>=64) throw new Error('Selector is too deep')
    if(path[i]==='.'){
      const match=/^[A-Za-z_$][A-Za-z0-9_$-]*/.exec(path.slice(++i))
      if(!match) throw new Error('Unsupported JSON selector')
      tokens.push(match[0]);i+=match[0].length
    }else if(path[i]==='['){
      i++
      if(path[i]==='"'||path[i]==="'"){
        const quote=path[i++]!;let value='',closed=false
        while(i<path.length){
          const character=path[i++]!
          if(character===quote){closed=true;break}
          if(character==='\\'){
            const escape=path[i++]!
            if(escape==='u'){
              const hex=path.slice(i,i+4);if(!/^[0-9a-f]{4}$/i.test(hex))throw new Error('Unsupported JSON selector')
              value+=String.fromCharCode(parseInt(hex,16));i+=4
            }else{
              const replacements:Record<string,string>={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f','\\':'\\','"':'"',"'":"'",'/':'/'}
              if(!Object.hasOwn(replacements,escape))throw new Error('Unsupported JSON selector')
              value+=replacements[escape]
            }
          }else{if(character.charCodeAt(0)<32)throw new Error('Unsupported JSON selector');value+=character}
        }
        if(!closed||path[i++]!==']')throw new Error('Unsupported JSON selector')
        tokens.push(value)
      }else{
        const match=/^(0|[1-9][0-9]*)\]/.exec(path.slice(i))
        if(!match || !Number.isSafeInteger(Number(match[1])))throw new Error('Unsupported JSON selector')
        tokens.push(Number(match[1]));i+=match[0].length
      }
    }else throw new Error('Unsupported JSON selector')
  }
  if(tokens.some(token=>typeof token==='string'&&blocked.has(token)))throw new Error('Prototype selectors are forbidden')
  return tokens
}
export function selectValue(root:unknown,path:string):{exists:boolean;value:unknown}{
  let value=root
  for(const token of parseSelector(path)){
    if(value===null||typeof value!=='object'||!Object.hasOwn(value,token))return {exists:false,value:undefined}
    value=(value as any)[token]
  }
  return {exists:true,value}
}
export function validateJsonBudget(value:unknown,maxBytes=1_048_576){
  const stack:{value:unknown;depth:number}[]=[{value,depth:0}];let nodes=0
  while(stack.length){
    const item=stack.pop()!;if(++nodes>100000||item.depth>64)throw new Error('JSON exceeds complexity limit')
    if(item.value===null||typeof item.value==='string'||typeof item.value==='boolean')continue
    if(typeof item.value==='number'){if(!Number.isFinite(item.value))throw new Error('Invalid JSON number');continue}
    if(typeof item.value!=='object'||(!Array.isArray(item.value)&&Object.getPrototypeOf(item.value)!==Object.prototype&&Object.getPrototypeOf(item.value)!==null))throw new Error('Invalid JSON value')
    for(const child of Object.values(item.value))stack.push({value:child,depth:item.depth+1})
  }
  if(Buffer.byteLength(JSON.stringify(value))>maxBytes)throw new Error('JSON exceeds size limit')
}
export function parseSafeJson(text:string):unknown{
  if(Buffer.byteLength(text)>1_048_576)throw new Error('JSON exceeds size limit')
  const value=JSON.parse(text);validateJsonBudget(value);return value
}
const expectedSchema=z.unknown().superRefine((value,ctx)=>{try{validateJsonBudget(value,4096)}catch{ctx.addIssue({code:'custom',message:'Expected value must be bounded JSON'})}})
const ruleSchema=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),source:z.enum(assertionSources),path:z.string().max(256).optional(),
  operator:z.enum(assertionOperators),expected:expectedSchema.optional()}).strict().superRefine((rule,ctx)=>{
  if(rule.source==='json'){try{parseSelector(rule.path||'')}catch{ctx.addIssue({code:'custom',message:'Use a supported JSON selector'})}}
  else if(rule.source==='header'){
    if(!rule.path||!/^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,256}$/.test(rule.path))ctx.addIssue({code:'custom',message:'A valid header name is required'})
  }else if(rule.path!==undefined)ctx.addIssue({code:'custom',message:'This source does not take a path'})
  if(!['exists','notExists','isNull','isNotNull'].includes(rule.operator)&&rule.expected===undefined)ctx.addIssue({code:'custom',message:'Expected value is required'})
  if(['gt','gte','lt','lte'].includes(rule.operator)&&(typeof rule.expected!=='number'||['header','text'].includes(rule.source)))ctx.addIssue({code:'custom',message:'Numeric comparisons require numeric values'})
  if(['equals','notEquals','contains','notContains'].includes(rule.operator)&&['header','text'].includes(rule.source)&&typeof rule.expected!=='string')ctx.addIssue({code:'custom',message:'Text/header comparisons require a string'})
  if(['status','responseTime'].includes(rule.source)&&!['exists','notExists','isNull','isNotNull'].includes(rule.operator)
    &&(typeof rule.expected!=='number'||['contains','notContains'].includes(rule.operator)))ctx.addIssue({code:'custom',message:'Status/time comparisons require a number'})
})
export const assertionsSchema=z.object({version:z.literal(1),mode:z.enum(['all','any']),rules:z.array(ruleSchema).max(20)}).strict().superRefine((set,ctx)=>{
  if(new Set(set.rules.map(rule=>rule.id)).size!==set.rules.length)ctx.addIssue({code:'custom',message:'Rule IDs must be unique'})
})
export interface AssertionResponse{status:number;elapsed:number;headers:Record<string,string>;body:string}
export function evaluateRule(rule:AssertionRule,exists:boolean,value:unknown):AssertionRuleResult{
  let passed=false,reason:AssertionRuleResult['reason']='value_mismatch'
  switch(rule.operator){
    case 'exists':passed=exists;reason='missing';break
    case 'notExists':passed=!exists;reason='unexpected_value';break
    case 'isNull':passed=exists&&value===null;reason=exists?'not_null':'missing';break
    case 'isNotNull':passed=exists&&value!==null;reason=exists?'is_null':'missing';break
    default:
      if(!exists){reason='missing';break}
      if(['gt','gte','lt','lte'].includes(rule.operator)){
        if(typeof value!=='number'||typeof rule.expected!=='number'){reason='type_mismatch';break}
        passed=rule.operator==='gt'?value>rule.expected:rule.operator==='gte'?value>=rule.expected:rule.operator==='lt'?value<rule.expected:value<=rule.expected
      }else if(['contains','notContains'].includes(rule.operator)){
        if(typeof value==='string'&&typeof rule.expected==='string')passed=value.includes(rule.expected)
        else if(Array.isArray(value))passed=value.some(item=>isDeepStrictEqual(item,rule.expected))
        else{reason='type_mismatch';break}
        if(rule.operator==='notContains')passed=!passed
      }else{
        passed=isDeepStrictEqual(value,rule.expected)
        if(rule.operator==='notEquals')passed=!passed
      }
  }
  return {ruleId:rule.id,source:rule.source,operator:rule.operator,passed,reason:passed?'passed':reason}
}
export function evaluateAssertions(input:unknown,response:AssertionResponse):AssertionEvaluation{
  const parsed=assertionsSchema.safeParse(input)
  if(!parsed.success)return {passed:false,rules:[],error:'CONFIG_ERROR'}
  const set=parsed.data as AssertionSet;let json:unknown
  if(set.rules.some(rule=>rule.source==='json')){try{json=parseSafeJson(response.body)}catch{return {passed:false,rules:[],error:'INVALID_JSON'}}}
  const headers=Object.fromEntries(Object.entries(response.headers).map(([name,value])=>[name.toLowerCase(),value]))
  const rules=set.rules.map(rule=>{
    let selected:{exists:boolean;value:unknown}
    if(rule.source==='json')selected=selectValue(json,rule.path!)
    else if(rule.source==='header')selected={exists:Object.hasOwn(headers,rule.path!.toLowerCase()),value:headers[rule.path!.toLowerCase()]}
    else selected={exists:true,value:rule.source==='status'?response.status:rule.source==='responseTime'?response.elapsed:response.body}
    return evaluateRule(rule,selected.exists,selected.value)
  })
  return {passed:!rules.length||(set.mode==='all'?rules.every(rule=>rule.passed):rules.some(rule=>rule.passed)),rules}
}
