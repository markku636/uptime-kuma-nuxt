import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encryptSecret, decryptSecret, resolveVariables } from '../server/utils/variables'
process.env.APP_ENCRYPTION_KEY='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
test('AES-GCM envelopes authenticate ciphertext and workspace/environment/name context',()=>{
  const secret=encryptSecret('secret-sentinel','1:2:token')
  assert.ok(!secret.includes('secret-sentinel')); assert.equal(decryptSecret(secret,'1:2:token'),'secret-sentinel')
  assert.throws(()=>decryptSecret(secret,'1:3:token'))
  assert.throws(()=>decryptSecret(secret.slice(0,-3)+'AAA','1:2:token'))
  const old=process.env.APP_ENCRYPTION_KEY; delete process.env.APP_ENCRYPTION_KEY
  assert.throws(()=>encryptSecret('secret','1:2:token')); process.env.APP_ENCRYPTION_KEY=old
})
test('static variables reject missing variables and prototype names without code evaluation',()=>{
  assert.equal(resolveVariables('{{base}}/v1/{{ id }}',{base:'https://example.test',id:'42'}),'https://example.test/v1/42')
  assert.throws(()=>resolveVariables('{{missing}}',{})); assert.throws(()=>resolveVariables('{{process.env.SECRET}}',{}))
  assert.throws(()=>resolveVariables('{{__proto__}}',{})); assert.throws(()=>resolveVariables('{{foo()}}',{}))
})
