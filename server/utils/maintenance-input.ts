import {z} from 'zod'
import {Cron} from 'croner'
function array(value:unknown){if(typeof value==='string'){try{return JSON.parse(value)}catch{return value}}return value}
const clock=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
export const maintenanceSchema=z.object({
 title:z.string().trim().min(1).max(200),description:z.string().max(10000).nullable().optional(),
 strategy:z.enum(['manual','single','recurring-interval','recurring-weekday','recurring-day-of-month','cron']).default('manual'),active:z.boolean().default(true),
 startDate:z.string().datetime({offset:true}).nullable().optional(),endDate:z.string().datetime({offset:true}).nullable().optional(),
 timezone:z.string().max(100).default('UTC'),duration:z.number().int().min(1).max(604800).default(60),cron:z.string().max(200).nullable().optional(),intervalDay:z.number().int().min(1).max(365).default(1),
 timeRange:z.preprocess(array,z.tuple([clock,clock]).nullable().optional()),weekdays:z.preprocess(array,z.array(z.number().int().min(0).max(6)).max(7).nullable().optional()),daysOfMonth:z.preprocess(array,z.array(z.union([z.number().int().min(1).max(31),z.literal('lastDay1')])).max(32).nullable().optional()),
 dateRange:z.preprocess(array,z.tuple([z.string().datetime({offset:true}),z.string().datetime({offset:true})]).nullable().optional()),
 monitorIds:z.array(z.number().int().positive()).max(4000).optional(),statusPageIds:z.array(z.number().int().positive()).max(4000).optional(),
}).strict()
export function normalizeMaintenance(body:any,existing?:any){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('Invalid maintenance input')
 const patch=maintenanceSchema.partial().safeParse(body);if(!patch.success)throw Error('Invalid maintenance fields')
 const base:any={};if(existing)for(const key of Object.keys(maintenanceSchema.shape))if(existing[key]!==undefined)base[key]=existing[key] instanceof Date?existing[key].toISOString():existing[key]
 const supplied=Object.fromEntries(Object.entries(patch.data).filter(([key])=>Object.hasOwn(body,key)))
 const merged={...base,...supplied}
 if(Object.hasOwn(body,'dateRange')&&patch.data.dateRange){merged.startDate=patch.data.dateRange[0];merged.endDate=patch.data.dateRange[1]}
 const parsed=maintenanceSchema.safeParse(merged);if(!parsed.success)throw Error('Invalid maintenance configuration')
 const value=parsed.data
 if(value.timezone==='SAME_AS_SERVER')value.timezone=process.env.TZ||'UTC'
 try{new Intl.DateTimeFormat('en',{timeZone:value.timezone}).format()}catch{throw Error('Invalid timezone')}
 const start=value.startDate?new Date(value.startDate):null,end=value.endDate?new Date(value.endDate):null
 if(start&&end&&start>=end)throw Error('Start must precede end')
 if(value.strategy==='single'&&(!start||!end))throw Error('Single maintenance requires startDate and endDate')
 if(value.strategy.startsWith('recurring-')){
  if(!value.timeRange||value.timeRange[0]===value.timeRange[1])throw Error('Recurring maintenance requires a nonempty timeRange')
  if(value.strategy==='recurring-interval'&&(!start||!value.intervalDay))throw Error('Interval maintenance requires startDate and intervalDay')
  if(value.strategy==='recurring-weekday'&&!value.weekdays?.length)throw Error('Select weekdays')
  if(value.strategy==='recurring-day-of-month'&&!value.daysOfMonth?.length)throw Error('Select days of month')
 }
 if(value.strategy==='cron'){try{if(!value.cron)throw Error();const schedule=new Cron(value.cron,{timezone:value.timezone,paused:true});schedule.stop()}catch{throw Error('Invalid cron expression')}}
 const {monitorIds,statusPageIds,...fields}=value
 return {monitorIds:supplied.monitorIds as number[]|undefined,statusPageIds:supplied.statusPageIds as number[]|undefined,fields:{...fields,startDate:start,endDate:end,timeRange:value.timeRange?JSON.stringify(value.timeRange):null,weekdays:value.weekdays?JSON.stringify([...new Set(value.weekdays)]):null,daysOfMonth:value.daysOfMonth?JSON.stringify([...new Set(value.daysOfMonth)]):null,dateRange:start&&end?JSON.stringify([start.toISOString(),end.toISOString()]):null}}
}
