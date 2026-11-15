import {Cron} from 'croner'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import {workerPrisma} from '../../utils/worker-prisma'
dayjs.extend(utc);dayjs.extend(timezone)
interface Timeslot{startDate:string;endDate:string}
const decoded=(value:any)=>{if(Array.isArray(value))return value;try{return JSON.parse(value||'[]')}catch{return []}}
const zone=(m:any)=>!m.timezone||m.timezone==='SAME_AS_SERVER'?process.env.TZ||'UTC':m.timezone
function slots(m:any,now:Date,days=8):Timeslot[]{
 if(m.strategy==='manual')return []
 if(m.strategy==='single')return m.startDate&&m.endDate?[{startDate:new Date(m.startDate).toISOString(),endDate:new Date(m.endDate).toISOString()}]:[]
 if(m.strategy==='cron'){
  const duration=Number(m.duration)*1000;if(!(duration>0&&duration<=604800000))return []
  const schedule=new Cron(m.cron,{timezone:zone(m),paused:true}),result:Timeslot[]=[]
  try{let point=new Date(now.getTime()-duration-1);for(let n=0;n<3;n++){const start=schedule.nextRun(point);if(!start)break;result.push({startDate:start.toISOString(),endDate:new Date(start.getTime()+duration).toISOString()});point=start}return result}finally{schedule.stop()}
 }
 const range=decoded(m.timeRange);if(range.length!==2||range.some((t:any)=>typeof t!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))||range[0]===range[1])return []
 const localDate=dayjs(now).tz(zone(m)).format('YYYY-MM-DD'),today=dayjs.utc(localDate),anchor=m.startDate?dayjs(m.startDate).tz(zone(m)).format('YYYY-MM-DD'):null,result:Timeslot[]=[]
 for(let offset=-1;offset<days;offset++){
  const day=today.add(offset,'day'),date=day.format('YYYY-MM-DD'),weekday=day.day(),monthday=day.date(),last=day.endOf('month').date()
  let enabled=false
  if(m.strategy==='recurring-interval'&&anchor){const delta=day.diff(dayjs.utc(anchor),'day');enabled=delta>=0&&delta%Math.max(1,m.intervalDay||1)===0}
  if(m.strategy==='recurring-weekday')enabled=decoded(m.weekdays).includes(weekday)
  if(m.strategy==='recurring-day-of-month')enabled=decoded(m.daysOfMonth).some((value:any)=>value===monthday||value==='lastDay1'&&monthday===last)
  if(!enabled)continue
  const endDate=range[1]<=range[0]?day.add(1,'day').format('YYYY-MM-DD'):date,start=dayjs.tz(`${date}T${range[0]}:00`,zone(m)),end=dayjs.tz(`${endDate}T${range[1]}:00`,zone(m))
  if(end.valueOf()>start.valueOf())result.push({startDate:start.toISOString(),endDate:end.toISOString()})
 }
 return result
}
export async function getMaintenanceStatus(m:any,now=new Date()):Promise<string>{
 if(!m.active)return 'inactive'
 if(m.strategy==='manual')return 'under-maintenance'
 if(m.startDate&&now<new Date(m.startDate))return 'scheduled'
 if(m.endDate&&now>=new Date(m.endDate))return 'ended'
 if(m.strategy==='single'&&(!m.startDate||!m.endDate))return 'unsupported'
 if(!['single','cron','recurring-interval','recurring-weekday','recurring-day-of-month'].includes(m.strategy))return 'unsupported'
 try{return slots(m,now,1).some(slot=>now>=new Date(slot.startDate)&&now<new Date(slot.endDate))?'under-maintenance':'scheduled'}catch{return 'unsupported'}
}
export async function isMonitorUnderMaintenance(monitorId:number,workspaceId?:number,db=workerPrisma):Promise<boolean>{
 const rows=await db.maintenanceMonitor.findMany({where:{monitorId,...(workspaceId?{maintenance:{workspaceId}}:{})},include:{maintenance:true}}),now=new Date()
 for(const row of rows)if(await getMaintenanceStatus(row.maintenance,now)==='under-maintenance')return true
 return false
}
export async function getMaintenanceTimeslots(m:any,now=new Date()){try{return slots(m,now).filter(slot=>new Date(slot.endDate)>now).slice(0,3)}catch{return []}}
export async function maintenanceToPublicJSON(m:any){return {id:m.id,title:m.title,description:m.description,strategy:m.strategy,active:m.active,timezone:zone(m),startDate:m.startDate,endDate:m.endDate,intervalDay:m.intervalDay,duration:m.duration,durationMinutes:m.duration/60,cron:m.cron,dateRange:decoded(m.dateRange),timeRange:decoded(m.timeRange),weekdays:decoded(m.weekdays),daysOfMonth:decoded(m.daysOfMonth),status:await getMaintenanceStatus(m),timeslotList:await getMaintenanceTimeslots(m)}}
// Compatibility hooks are deliberately side-effect free; workers evaluate shared DB/time state.
export async function startMaintenanceJob(_maintenance:any){}
export function stopMaintenanceJob(_id:number){}
export function stopAllMaintenanceJobs(){}
export async function initializeMaintenanceScheduler(){}
export function validateCron(expression:string){try{const job=new Cron(expression,{paused:true});job.stop();return true}catch{return false}}
