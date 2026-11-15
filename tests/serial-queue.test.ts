import {test} from 'node:test'
import assert from 'node:assert/strict'
import {SerialQueue} from '../server/utils/serial-queue'
test('subscription authorization preserves arrival order when the first DB authorization is delayed',async()=>{
 const authorization=new SerialQueue(3),mutations=new SerialQueue(3),order:string[]=[];let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve)
 const first=authorization.enqueue(async()=>{await gate;order.push('auth old');void mutations.enqueue(()=>{order.push('old page')})})
 const second=authorization.enqueue(async()=>{order.push('auth new');void mutations.enqueue(()=>{order.push('new page')})})
 await Promise.resolve();assert.deepEqual(order,[]);release();await Promise.all([first,second]);await mutations.enqueue(()=>{})
 assert.deepEqual(order,['auth old','old page','auth new','new page'])
})
test('queue bounds pending work, recovers after a failed task and never strands capacity',async()=>{
 const queue=new SerialQueue(1);let release!:()=>void;const pending=queue.enqueue(()=>new Promise<void>(resolve=>release=resolve));await Promise.resolve();await assert.rejects(queue.enqueue(()=>{}),/QUEUE_FULL/);release();await pending;await new Promise(resolve=>setImmediate(resolve));assert.equal(queue.pending,0);await assert.rejects(queue.enqueue(()=>{throw Error('fixture')}));await new Promise(resolve=>setImmediate(resolve));await queue.enqueue(()=>{})
})
