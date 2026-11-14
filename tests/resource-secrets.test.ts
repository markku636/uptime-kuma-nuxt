import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sealResource,hydrateResource,resourceDTO,applyResourceUpdates,resourceDefinitions,type SecretResource} from '../server/utils/resource-secrets'
process.env.APP_ENCRYPTION_KEY='0123456789abcdef'.repeat(4)
test('all four resource envelopes clear plaintext and DTOs whitelist metadata',()=>{
  for(const kind of Object.keys(resourceDefinitions) as SecretResource[]){
    const values=Object.fromEntries(resourceDefinitions[kind].fields.map(key=>[key,key==='config'?{token:'SECRET_SENTINEL'}:'SECRET_SENTINEL']))
    const row={id:5,workspaceId:2,name:'Safe',type:'webhook',active:true,...values},sealed={...row,...sealResource(kind,row)}
    assert.ok(!JSON.stringify(resourceDTO(kind,sealed)).includes('SECRET_SENTINEL'))
    assert.ok(!JSON.stringify(resourceDTO(kind,sealed)).includes('enc:v1:'))
    for(const key of resourceDefinitions[kind].fields)assert.deepEqual(hydrateResource(kind,sealed)[key],values[key])
    assert.ok(!JSON.stringify({...sealed,resourceSecrets:undefined}).includes('SECRET_SENTINEL'))
  }
})
test('resource AAD rejects cross ID, workspace and type envelope substitution',()=>{
  const row={id:1,workspaceId:2,url:'SECRET'},sealed={...row,...sealResource('remoteBrowser',row)}
  assert.throws(()=>hydrateResource('remoteBrowser',{...sealed,id:2}))
  assert.throws(()=>hydrateResource('remoteBrowser',{...sealed,workspaceId:3}))
  assert.throws(()=>hydrateResource('proxy',sealed))
  assert.throws(()=>hydrateResource('remoteBrowser',{...sealed,resourceSecrets:sealed.resourceSecrets+'x'}))
})
test('omission preserves, explicit clear deletes and replacement wins in shared test/save merge',()=>{
  const row={id:1,workspaceId:2,url:'OLD'},sealed={...row,...sealResource('remoteBrowser',row)}
  assert.equal(applyResourceUpdates('remoteBrowser',sealed,{name:'Rename'}).url,'OLD')
  assert.equal(applyResourceUpdates('remoteBrowser',sealed,{clearSecrets:['url']}).url,'')
  assert.equal(applyResourceUpdates('remoteBrowser',sealed,{clearSecrets:['url'],url:'NEW'}).url,'NEW')
})
