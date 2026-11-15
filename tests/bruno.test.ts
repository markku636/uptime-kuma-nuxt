import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile,readdir} from 'node:fs/promises'
import {parseBrunoManifest} from '../server/services/bruno/parser'
import {brunoInputSchema} from '../server/utils/bruno-input'
import type {BrunoFile,BrunoManifest} from '../shared/types/bruno'
async function fixtureFiles(root='tests/fixtures/bruno/nested',prefix=''):Promise<BrunoFile[]>{
  const files:BrunoFile[]=[]
  for(const entry of await readdir(root+'/'+prefix,{withFileTypes:true})){const file=prefix+entry.name;if(entry.isDirectory())files.push(...await fixtureFiles(root,file+'/'));else files.push({path:file,content:await readFile(root+'/'+file,'utf8')})}
  return files
}
const request=(extra='')=>`meta {\n name: Health\n type: http\n}\nget {\n url: http://127.0.0.1/\n body: none\n auth: none\n}\n${extra}`
function manifest(content:string):BrunoManifest{return{collectionId:'unit',mode:'create',files:[{path:'health.bru',content}]}}
test('official parser handles nested scopes, two environments, disabled values, query/body/basic auth and typed assertions',async()=>{
  const parsed=await parseBrunoManifest({collectionId:'local',mode:'create',sourceEnvironment:'environments/local.bru',files:await fixtureFiles(),secrets:{token:'SECRET'}})
  assert.deepEqual(parsed.issues,[]);assert.equal(parsed.requests.length,1);assert.equal(parsed.environments.length,2)
  const config=parsed.requests[0]!.config
  assert.equal(config.url,'{{origin}}/health');assert.equal(config.headers['x-scope'],'request');assert.equal(config.headers['x-folder'],'request');assert.equal(config.headers['x-fallback'],'collection-fallback')
  assert.equal(config.headers['x-collection'],'enabled');assert.ok(!('x-disabled'in config.headers))
  assert.deepEqual(config.queryParams,[{name:'token',value:'{{token}}'}]);assert.equal(config.basicAuthPass,'{{token}}');assert.equal(JSON.parse(config.body).scope,'request')
  assert.equal(config.assertions.rules.length,3);assert.equal(config.assertions.rules[0].expected,200);assert.equal(config.assertions.rules[1].expected,true);assert.equal(config.assertions.rules[2].source,'header')
  assert.equal(config.active,false);assert.equal(parsed.secrets.token,'SECRET')
})
test('duplicate HTTP blocks, unknown fields and unsupported expressions are explicit errors',async()=>{
  const cases:[string,string][]=[
    ['post {\n url: http://127.0.0.1/\n}\n','DUPLICATE_HTTP_BLOCK'],['params:path {\n id: 1\n}\n','UNSUPPORTED_BLOCK'],
    ['assert {\n res.body.value: eq process.env.SECRET_SENTINEL\n}\n','UNSUPPORTED_ASSERTION'],['assert {\n res.body[?(@.secret)]: eq true\n}\n','INVALID_SYNTAX'],
    ['headers {\n X-Test: one\n x-test: two\n}\n','DUPLICATE_PAIR'],['body:xml {\n <secret/>\n}\n','UNSUPPORTED_BLOCK']
  ]
  for(const [extra,code]of cases){const parsed=await parseBrunoManifest(manifest(request(extra)));assert.ok(parsed.issues.some(issue=>issue.code===code),JSON.stringify(parsed.issues));assert.ok(!JSON.stringify(parsed.issues).includes('SECRET_SENTINEL'))}
  const unknown=await parseBrunoManifest(manifest(request().replace(' body: none',' unknown: SECRET_SENTINEL\n body: none')));assert.equal(unknown.issues[0]?.code,'UNSUPPORTED_FIELD')
})
test('path, byte, variable cycles and secret placeholders fail without emitting source values',async()=>{
  for(const file of ['../outside.bru','/absolute.bru','a/../b.bru','a\\b.bru','a//b.bru'])assert.equal((await parseBrunoManifest({collectionId:'x',mode:'create',files:[{path:file,content:request()}]})).issues[0]?.code,'INVALID_PATH')
  const duplicate=manifest(request());duplicate.files.push({...duplicate.files[0]!});assert.equal((await parseBrunoManifest(duplicate)).issues[0]?.code,'DUPLICATE_PATH')
  assert.equal((await parseBrunoManifest(manifest('x'.repeat(131073)))).issues[0]?.code,'FILE_TOO_LARGE')
  const files=await fixtureFiles();const missing=await parseBrunoManifest({collectionId:'x',mode:'create',sourceEnvironment:'environments/local.bru',files})
  assert.equal(missing.issues[0]?.code,'MISSING_SECRET');assert.deepEqual(missing.missingSecrets,['token'])
  const cycle=await parseBrunoManifest({collectionId:'x',mode:'create',files:[{path:'health.bru',content:request().replace('http://127.0.0.1/','{{a}}')}],variables:{a:'{{b}}',b:'{{a}}'}})
  assert.equal(cycle.issues[0]?.code,'VARIABLE_CYCLE')
  const host=await parseBrunoManifest(manifest(request().replace('http://127.0.0.1/','{{process.env.HOME}}')));assert.equal(host.issues[0]?.code,'UNSUPPORTED_VARIABLE')
  assert.equal(brunoInputSchema.safeParse({collectionId:'x',mode:'create',files,unexpected:'value'}).success,false)
})
test('bearer inheritance follows explicit auth mode and never activates unused credentials',async()=>{
  const collection={path:'collection.bru',content:'auth {\n mode: bearer\n}\nauth:bearer {\n token: static-token\n}\n'}
  const inherited=await parseBrunoManifest({collectionId:'x',mode:'create',files:[collection,{path:'inherited.bru',content:request().replace(' auth: none',' auth: inherit')}]})
  assert.deepEqual(inherited.issues,[]);assert.equal(inherited.requests[0]!.config.headers.authorization,'Bearer static-token')
  const none=await parseBrunoManifest({collectionId:'x',mode:'create',files:[collection,{path:'none.bru',content:request()}]})
  assert.deepEqual(none.issues,[]);assert.equal(none.requests[0]!.config.headers.authorization,undefined)
})
test('export produces a reparseable supported manifest with secret placeholders and intact assertion types',async()=>{
  const {exportBrunoMonitors}=await import('../server/services/bruno/exporter')
  const output=exportBrunoMonitors([{id:1,name:'Export',type:'http',url:'http://localhost/?token=EXPORT_SECRET',headers:{Authorization:'Bearer EXPORT_SECRET'},body:'EXPORT_SECRET',authMethod:'basic',basicAuthUser:'user',basicAuthPass:'EXPORT_SECRET',method:'POST',timeout:30,maxRedirects:10,queryParams:[{name:'token',value:'EXPORT_SECRET'}],assertions:{version:1,mode:'all',rules:[{id:'typed',source:'json',path:'$.success',operator:'equals',expected:true}]}}],'roundtrip')
  assert.ok(!JSON.stringify(output).includes('EXPORT_SECRET'))
  const {secretNames,notice,...manifest}=output
  const parsed=await parseBrunoManifest({...manifest,secrets:Object.fromEntries(secretNames.map(name=>[name,name.endsWith('_url')?'http://localhost/':'configure']))})
  assert.deepEqual(parsed.issues,[]);assert.equal(parsed.requests[0]!.config.assertions.rules[0].expected,true)
  assert.throws(()=>exportBrunoMonitors([{id:2,name:'Unsupported',type:'http',url:'http://localhost',method:'GET',timeout:48}],'bad'),/UNSUPPORTED_TRANSPORT_SETTINGS/)
})

test('environment outranks collection and secret dependencies never downgrade into plaintext variables',async()=>{
  const input:BrunoManifest={collectionId:'precedence',mode:'create',variables:{shared:'environment'},files:[{path:'collection.bru',content:'vars:pre-request {\n shared: collection\n}\n'},{path:'request.bru',content:request('headers {\n X-Value: {{shared}}\n}\n')}]}
  const result=await parseBrunoManifest(input);assert.deepEqual(result.issues,[]);assert.equal(result.requests[0]!.config.headers['x-value'],'{{shared}}')
  for(const variables of [{shared:'{{privateToken}}'},{shared:'{{alias}}',alias:'{{privateToken}}'},{privateToken:'public literal'}]){
    const parsed=await parseBrunoManifest({...input,variables},{privateToken:'PRIVATE_SENTINEL'},['privateToken'])
    assert.equal(parsed.issues[0]?.code,'SECRET_TO_STATIC_VARIABLE');assert.ok(!JSON.stringify(parsed.issues).includes('PRIVATE_SENTINEL'))
  }
})

test('existing target values and supplied secret values are opaque, including literal template braces',async()=>{
  const existing=await parseBrunoManifest(manifest(request()),{unusedSecret:'literal{{unrelated}}'},['unusedSecret'])
  assert.deepEqual(existing.issues,[])
  const input={...manifest(request('headers {\n X-Token: {{token}}\n}\n')),secrets:{token:'literal{{unrelated}}'}}
  const supplied=await parseBrunoManifest(input);assert.deepEqual(supplied.issues,[]);assert.equal(supplied.secrets.token,'literal{{unrelated}}');assert.equal(supplied.requests[0]!.config.headers['x-token'],'{{token}}')
})
