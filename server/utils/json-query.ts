import { evaluateRule, parseSafeJson, selectValue } from './assertions'
import type { AssertionRule } from '../../shared/types/assertions'
export async function evaluateJsonQuery(value:unknown,jsonPath:string|null,operator:string|null,expectedValue:string|null){
  try{
    if(Buffer.isBuffer(value))value=value.toString('utf8')
    if(typeof value==='string'){try{value=parseSafeJson(value)}catch{if(jsonPath)throw new Error('Invalid JSON')}}
    const selected=jsonPath?selectValue(value,jsonPath):{exists:value!==undefined,value}
    if(!operator||expectedValue===null)return {status:selected.exists,response:selected.exists?'Value exists':'Value is missing'}
    let expected:unknown;try{expected=JSON.parse(expectedValue)}catch{expected=expectedValue}
    const aliases:Record<string,AssertionRule['operator']>={'==':'equals','equals':'equals','!=':'notEquals','not equals':'notEquals','>':'gt','greater than':'gt','>=':'gte','greater than or equal':'gte','<':'lt','less than':'lt','<=':'lte','less than or equal':'lte','contains':'contains','not contains':'notContains'}
    if(['starts with','ends with'].includes(operator))return {status:typeof selected.value==='string'&&typeof expected==='string'&&(operator==='starts with'?selected.value.startsWith(expected):selected.value.endsWith(expected)),response:'String condition evaluated'}
    const mapped=aliases[operator];if(!mapped)return {status:false,response:'Unsupported comparison operator'}
    const result=evaluateRule({id:'legacy',source:'json',operator:mapped,expected:expected as any},selected.exists,selected.value)
    return {status:result.passed,response:result.passed?'Condition matched':'Condition did not match'}
  }catch{return {status:false,response:'Invalid or unsupported JSON selector'}}
}
