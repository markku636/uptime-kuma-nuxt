import { test,before,after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { checkHttp } from '../server/services/monitor/checkers/http-checker'
import { closeHttpAgents } from '../server/services/monitor/checkers/http-request'
let server:http.Server,url:string
let status=200,body='{"ok":true,"value":1,"secret":"ACTUAL-SECRET"}'
const assertion=(rules:any[],mode='all')=>({version:1,mode,rules})
const jsonRule={id:'ok',source:'json',path:'$.ok',operator:'equals',expected:true}
before(async()=>{server=http.createServer((req,res)=>{if(req.url==='/broken'){req.socket.destroy();return}res.writeHead(status,{'X-State':'ready'});res.end(body)});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${(server.address() as any).port}`})
after(async()=>{closeHttpAgents();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))})
async function check(extra:any={}){return checkHttp({type:'http',url,timeout:1,assertions:assertion([jsonRule]),...extra},Date.now())}
test('HTTP 200 wrong JSON is DOWN; corrected JSON is UP with safe per-rule diagnostics',async()=>{
  body='{"ok":false,"secret":"ACTUAL-SECRET"}';const failed=await check();assert.equal(failed.status,0);assert.equal(failed.code,'ASSERTIONS_FAILED');assert.equal(failed.assertionResults?.rules[0]?.passed,false)
  assert.ok(!JSON.stringify(failed).includes('ACTUAL-SECRET'))
  body='{"ok":true,"value":1,"secret":"ACTUAL-SECRET"}';assert.equal((await check()).status,1)
})
test('explicit status assertions override defaults; no status rule retains the HTTP status gate',async()=>{
  status=404
  assert.equal((await check({assertions:assertion([{id:'status',source:'status',operator:'equals',expected:404}])})).status,1)
  assert.equal((await check()).code,'HTTP_STATUS')
  assert.equal((await check({acceptedStatuscodes:['400-499']})).status,1)
  status=200
})
test('invalid JSON remains DOWN under any and upside down; logical failures can be inverted',async()=>{
  const rules=[{id:'status',source:'status',operator:'equals',expected:200},jsonRule]
  body='{"ok":false}';assert.equal((await check({assertions:assertion(rules,'any')})).status,1)
  assert.equal((await check({upsideDown:true})).status,1)
  body='invalid ACTUAL-SECRET';const result=await check({assertions:assertion(rules,'any'),upsideDown:true});assert.equal(result.status,0);assert.equal(result.code,'INVALID_JSON');assert.ok(!JSON.stringify(result).includes('ACTUAL-SECRET'))
  body='{"ok":true,"value":1}'
})
test('legacy JSON query uses safe typed selectors and never prints actual values',async()=>{
  assert.equal((await check({type:'json-query',jsonPath:'$.value',expectedValue:'1'})).status,1)
  const wrong=await check({type:'json-query',jsonPath:'$.value',expectedValue:'2'});assert.equal(wrong.status,0);assert.equal(wrong.code,'JSON_QUERY_MISMATCH')
  assert.equal((await check({type:'json-query',jsonPath:'$[?(@.value)]',expectedValue:'1'})).code,'CONFIG_ERROR')
  const network=await check({url:url+'/broken'});assert.equal(network.code,'NETWORK_ERROR');assert.ok(!JSON.stringify(network).includes(url))
})
