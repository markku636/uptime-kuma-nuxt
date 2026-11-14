import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertionsSchema, evaluateAssertions, evaluateRule, parseSelector, selectValue } from '../server/utils/assertions'
import type { AssertionRule } from '../shared/types/assertions'
const response={status:200,elapsed:123,headers:{'X-Status':'ready'},body:JSON.stringify({ok:true,n:0,empty:'',nothing:null,list:[1,false],nested:{'a.b':'value'}})}
const rule=(operator:AssertionRule['operator'],expected?:any):AssertionRule=>({id:'r',source:'json',path:'$.n',operator,...(expected!==undefined?{expected}:{})})
test('every supported comparison operator has positive and negative cases',()=>{
  for(const [operator,value,expected,positive,negative] of [
    ['equals',2,2,true,false],['notEquals',2,3,true,false],['contains','abcdef','bcd',true,false],['notContains','abcdef','xyz',true,false],
    ['gt',3,2,true,false],['gte',3,3,true,false],['lt',2,3,true,false],['lte',3,3,true,false],
  ] as const){
    const input=rule(operator,expected)
    assert.equal(evaluateRule(input,true,value).passed,positive,operator)
    const opposite=operator==='equals'?3:operator==='notEquals'?3:operator==='contains'?'xyz':operator==='notContains'?'xyz':operator==='gt'?1:operator==='gte'?2:operator==='lt'?4:4
    assert.equal(evaluateRule(input,true,opposite).passed,negative,operator)
  }
  assert.equal(evaluateRule(rule('contains',false),true,[1,false]).passed,true)
  assert.equal(evaluateRule(rule('equals',1),true,'1').passed,false)
  assert.equal(evaluateRule(rule('gt',1),true,'2').reason,'type_mismatch')
})
test('missing, null, false, zero and empty string are distinct',()=>{
  assert.equal(evaluateRule(rule('exists'),true,null).passed,true)
  assert.equal(evaluateRule(rule('exists'),false,undefined).passed,false)
  assert.equal(evaluateRule(rule('notExists'),false,undefined).passed,true)
  assert.equal(evaluateRule(rule('notExists'),true,null).passed,false)
  assert.equal(evaluateRule(rule('isNull'),true,null).passed,true)
  assert.equal(evaluateRule(rule('isNull'),false,undefined).passed,false)
  assert.equal(evaluateRule(rule('isNotNull'),true,false).passed,true)
  assert.equal(evaluateRule(rule('isNotNull'),true,null).passed,false)
  for(const value of [false,0,''])assert.equal(evaluateRule(rule('equals',value),true,value).passed,true)
  for(const operator of ['equals','notEquals','contains','notContains','gt'] as const)assert.equal(evaluateRule(rule(operator,1),false,undefined).passed,false)
})
test('selectors support quoted properties and indexes without evaluating code',()=>{
  assert.deepEqual(parseSelector('$["a.b"][0][\'quote\\\'d\']'),['a.b',0,"quote'd"])
  assert.deepEqual(selectValue({array:[{x:42}]},'$.array[0].x'),{exists:true,value:42})
  for(const path of ['$..x','$[?(@.x)]','$[0+1]','$[01]','$[-1]','$.constructor','$["__proto__"]','$["\\u005f_proto__"]','$.x()','x','$.','$.x;process.exit()'])assert.throws(()=>parseSelector(path),path)
})
test('sources, case-insensitive headers and all/any use the same evaluator',()=>{
  const config={version:1,mode:'all',rules:[{id:'status',source:'status',operator:'equals',expected:200},{id:'header',source:'header',path:'x-status',operator:'equals',expected:'ready'},{id:'json',source:'json',path:'$.n',operator:'equals',expected:0},{id:'time',source:'responseTime',operator:'lte',expected:200},{id:'text',source:'text',operator:'contains',expected:'"ok":true'}]}
  assert.equal(evaluateAssertions(config,response).passed,true)
  config.rules[0]!.expected=500
  assert.equal(evaluateAssertions(config,response).passed,false)
  assert.equal(evaluateAssertions({...config,mode:'any'},response).passed,true)
  assert.equal(evaluateAssertions({...config,mode:'any'},{...response,body:'invalid JSON'}).error,'INVALID_JSON')
})
test('invalid config, excessive complexity and unknown execution features fail closed',()=>{
  const valid={version:1,mode:'all',rules:[rule('equals',0)]}
  assert.equal(assertionsSchema.safeParse(valid).success,true)
  for(const config of [{...valid,rules:[{...rule('equals',0),operator:'regex'}]},{...valid,rules:[{...rule('equals',0),source:'eval'}]},
    {...valid,rules:[{...rule('equals',0),expected:undefined}]},{...valid,rules:[rule('equals',0),rule('equals',1)]},
    {...valid,rules:Array.from({length:21},(_,i)=>({...rule('equals',0),id:String(i)}))},
    {...valid,rules:[{...rule('equals',0),path:'$.prototype'}]},
    {...valid,rules:[{id:'bad',source:'status',operator:'equals',expected:'200'}]},
    {...valid,rules:[{...rule('equals',0),expected:'x'.repeat(5000)}]}])assert.equal(assertionsSchema.safeParse(config).success,false)
  const body='['.repeat(66)+'0'+']'.repeat(66)
  assert.equal(evaluateAssertions(valid,{...response,body}).error,'INVALID_JSON')
  const serialized=JSON.stringify(evaluateAssertions({version:1,mode:'all',rules:[{id:'secret',source:'json',path:'$.secret',operator:'equals',expected:'EXPECTED-SECRET'}]},{...response,body:'{"secret":"ACTUAL-SECRET"}'}))
  assert.ok(!serialized.includes('ACTUAL-SECRET'));assert.ok(!serialized.includes('EXPECTED-SECRET'))
})
