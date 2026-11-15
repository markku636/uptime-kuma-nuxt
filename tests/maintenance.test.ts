import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeMaintenance} from '../server/utils/maintenance-input'
import {getMaintenanceStatus,getMaintenanceTimeslots} from '../server/services/maintenance/scheduler'
const status=(m:any,time:string)=>getMaintenanceStatus({active:true,timezone:'UTC',...m},new Date(time))
test('single/manual validation and half-open boundaries are explicit',async()=>{
 assert.throws(()=>normalizeMaintenance({title:'bad',strategy:'single'}),/requires/)
 assert.throws(()=>normalizeMaintenance({title:'bad',strategy:'recurring'}),/Invalid/)
 assert.throws(()=>normalizeMaintenance({title:'bad',timezone:'wrong/timezone'}),/timezone/)
 assert.throws(()=>normalizeMaintenance({title:'bad',strategy:'cron',cron:'invalid'}),/cron/)
 const m={strategy:'single',startDate:'2026-11-14T10:00:00Z',endDate:'2026-11-14T11:00:00Z'}
 assert.equal(await status(m,'2026-11-14T09:59:59Z'),'scheduled');assert.equal(await status(m,'2026-11-14T10:00:00Z'),'under-maintenance');assert.equal(await status(m,'2026-11-14T11:00:00Z'),'ended')
 assert.equal(await status({strategy:'manual',startDate:'2027-01-01T00:00:00Z',endDate:'2027-01-02T00:00:00Z'},'2026-11-14T10:00:00Z'),'under-maintenance');assert.equal(await status({strategy:'single'},'2026-11-14T10:00:00Z'),'unsupported');assert.equal(await status({strategy:'manual'},'2026-11-14T10:00:00Z'),'under-maintenance')
})
test('recurrence respects local windows, interval days, cross-midnight and skipped month dates',async()=>{
 const m={strategy:'recurring-interval',startDate:'2026-11-12T00:00:00Z',intervalDay:2,timeRange:'["10:00","11:00"]'}
 assert.equal(await status(m,'2026-11-14T04:00:00Z'),'scheduled');assert.equal(await status(m,'2026-11-14T10:00:00Z'),'under-maintenance');assert.equal(await status(m,'2026-11-14T11:00:00Z'),'scheduled');assert.equal(await status(m,'2026-11-15T10:30:00Z'),'scheduled')
 const cross={strategy:'recurring-weekday',timezone:'Asia/Taipei',weekdays:[6],timeRange:['23:00','01:00']}
 assert.equal(await status(cross,'2026-11-14T15:00:00Z'),'under-maintenance');assert.equal(await status(cross,'2026-11-14T16:59:59Z'),'under-maintenance');assert.equal(await status(cross,'2026-11-14T17:00:00Z'),'scheduled')
 assert.equal(await status({strategy:'recurring-day-of-month',daysOfMonth:[31],timeRange:['10:00','11:00']},'2026-04-30T10:30:00Z'),'scheduled')
 assert.equal(await status({strategy:'recurring-day-of-month',daysOfMonth:['lastDay1'],timeRange:['10:00','11:00']},'2026-04-30T10:30:00Z'),'under-maintenance')
})
test('cron duration is elapsed seconds across DST and timeslots share the same evaluator',async()=>{
 const m={active:true,strategy:'cron',timezone:'America/New_York',cron:'30 1 * * *',duration:1800}
 assert.equal(await getMaintenanceStatus(m,new Date('2026-11-01T05:30:00Z')),'under-maintenance');assert.equal(await getMaintenanceStatus(m,new Date('2026-11-01T06:00:00Z')),'scheduled')
 const slots=await getMaintenanceTimeslots(m,new Date('2026-11-01T05:40:00Z'));assert.equal(new Date(slots[0]!.endDate).getTime()-new Date(slots[0]!.startDate).getTime(),1800000)
})
