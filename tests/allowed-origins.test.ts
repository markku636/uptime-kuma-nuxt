import {test} from 'node:test'
import assert from 'node:assert/strict'
import {allowedOrigins} from '../server/utils/allowed-origins'
test('multiple domains require exact explicit origins and reject wildcard/credential/path configuration',()=>{
 assert.deepEqual(allowedOrigins('https://uptime.226network.com','https://uptime.markkulab.net,https://uptime.226network.com'),['https://uptime.226network.com','https://uptime.markkulab.net'])
 for(const value of ['https://*.example.com','https://user:pass@example.com','https://example.com/path','javascript:alert(1)'])assert.throws(()=>allowedOrigins('https://example.com',value))
})
