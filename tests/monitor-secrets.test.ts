import {test} from 'node:test'
import assert from 'node:assert/strict'
import {hydrateMonitor,sealMonitor,monitorSecretUpdate,monitorEditorDTO,applyMonitorUpdates} from '../server/utils/monitor-secrets'
process.env.APP_ENCRYPTION_KEY='0123456789abcdef'.repeat(4)
test('request envelope clears database plaintext, authenticates scope, preserves omitted edits and explicitly clears fields',()=>{
  const original={id:10,workspaceId:1,environmentId:2,name:'monitor',url:'http://localhost/?token=SECRET',headers:{Authorization:'SECRET'},body:'SECRET',basicAuthPass:'SECRET',authConfig:{clientSecret:'SECRET'},dockerHost:'https://user:SECRET@localhost'}
  const record:any={...original,...sealMonitor(original)}
  for(const field of ['url','body','basicAuthPass'])assert.equal(record[field],null)
  assert.ok(!record.requestSecrets.includes('SECRET'))
  assert.equal(hydrateMonitor(record).url,original.url)
  for(const scope of [{id:11},{workspaceId:2},{environmentId:3}])assert.throws(()=>hydrateMonitor({...record,...scope}))
  const changed={...record,...monitorSecretUpdate(record,{name:'renamed'})}
  assert.equal(hydrateMonitor(changed).headers.Authorization,'SECRET')
  const replaced={...changed,...monitorSecretUpdate(changed,{headers:{'X-New':'NEW'},clearSecrets:['body','authConfig']})}
  assert.deepEqual(hydrateMonitor(replaced).headers,{'X-New':'NEW'});assert.equal(hydrateMonitor(replaced).body,null)
  const ambiguous={headers:{'X-New':'replacement'},clearSecrets:['headers']}
  assert.deepEqual(applyMonitorUpdates(changed,ambiguous).headers,hydrateMonitor({...changed,...monitorSecretUpdate(changed,ambiguous)}).headers)
  const dto=monitorEditorDTO(changed)
  assert.equal(dto.configuredSecrets.headers,true);assert.equal(dto.name,'renamed');assert.ok(!JSON.stringify(dto).includes('SECRET'))
  assert.ok(!Object.hasOwn(dto,'requestSecrets'));assert.ok(!Object.hasOwn(dto,'url'))
})

test('Bruno .bru source is only exposed when the caller opts in', () => {
  const source = 'meta {\n  name: Visible\n  type: http\n}\nget {\n  url: https://example.com\n  body: none\n  auth: none\n}\n'
  const stored: any = {id: 20, workspaceId: 1, environmentId: 2, type: 'bruno', name: 'bruno', body: source}
  const record: any = {...stored, ...sealMonitor(stored)}
  assert.ok(!Object.hasOwn(monitorEditorDTO(record), 'body'))
  assert.ok(!Object.hasOwn(monitorEditorDTO(record, {includeBody: false}), 'body'))
  assert.match(monitorEditorDTO(record, {includeBody: true}).body, /res\.status|https:\/\/example\.com/)
})
