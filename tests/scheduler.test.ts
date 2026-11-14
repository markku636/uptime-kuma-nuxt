import {test} from 'node:test'
import assert from 'node:assert/strict'
import {initialMonitorSchedule,withoutMonitorLease} from '../server/utils/monitor-mutation'
import {positiveSetting} from '../server/services/monitor/runtime-config'
test('initial due times use stable interval-wide jitter and runtime fields never clone',()=>{
  const now=new Date('2026-11-14T00:00:00Z'),seen=new Set()
  for(let id=1;id<=4000;id++){const a=initialMonitorSchedule(id,60,now),b=initialMonitorSchedule(id,60,now);assert.deepEqual(a,b);const diff=a.nextCheckAt.getTime()-now.getTime();assert.ok(diff>=0&&diff<60000);seen.add(diff)}
  assert.equal(seen.size,60)
  assert.deepEqual(withoutMonitorLease({id:1,name:'Safe',leaseToken:23n,runId:'private-runtime',leaseUntil:now,nextCheckAt:now,states:[]}),{id:1,name:'Safe'})
})
test('worker integer settings reject invalid and unbounded values',()=>{
  const old=process.env.TEST_WORKER_OPTION
  try{for(const input of ['NaN','0','-1','9999','1.5','']){process.env.TEST_WORKER_OPTION=input;assert.throws(()=>positiveSetting('TEST_WORKER_OPTION',8,1,64))}delete process.env.TEST_WORKER_OPTION;assert.equal(positiveSetting('TEST_WORKER_OPTION',8,1,64),8)}finally{if(old===undefined)delete process.env.TEST_WORKER_OPTION;else process.env.TEST_WORKER_OPTION=old}
})
