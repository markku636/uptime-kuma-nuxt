import {test} from 'node:test'
import assert from 'node:assert/strict'
import {encodeCursor,decodeCursor} from '../server/utils/pagination'
test('signed cursors bind scope, filters and sort without accepting tampered or unbounded input',()=>{
 const secret='test-pagination-secret',binding={workspaceId:1,environmentId:2,sort:'id',search:'test',status:'all'},cursor=encodeCursor(binding,{id:120},secret)
 assert.deepEqual(decodeCursor(cursor,binding,secret),{id:120})
 for(const changed of [{...binding,workspaceId:2},{...binding,environmentId:3},{...binding,search:'other'},{...binding,sort:'weight'}])assert.throws(()=>decodeCursor(cursor,changed,secret),/INVALID_CURSOR/)
 assert.throws(()=>decodeCursor(cursor+'x',binding,secret),/INVALID_CURSOR/)
 assert.throws(()=>decodeCursor('x'.repeat(2049),binding,secret),/INVALID_CURSOR/)
})
