<script setup lang="ts">
const props=defineProps<{maintenance?:any}>(),emit=defineEmits<{saved:[data:any];cancel:[]}>(),{canEdit}=useWorkspace()
const busy=ref(false),error=ref(''),metadata=ref<any[]>([])
const form=reactive({title:'',description:'',strategy:'manual',active:true,startDate:'',endDate:'',timezone:'UTC',intervalDay:1,timeStart:'10:00',timeEnd:'11:00',weekdays:[] as number[],daysOfMonth:[] as (number|string)[],cron:'0 2 * * *',durationMinutes:30,monitorIds:[] as number[],statusPageIds:[] as number[]})
const decode=(value:any,fallback:any=[])=>{try{return typeof value==='string'?JSON.parse(value):value??fallback}catch{return fallback}}
const local=(value:any)=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
watch(()=>props.maintenance,m=>{if(!m)return;const range=decode(m.timeRange,['10:00','11:00']);Object.assign(form,{title:m.title,description:m.description||'',strategy:m.strategy,active:m.active,startDate:local(m.startDate),endDate:local(m.endDate),timezone:m.timezone||'UTC',intervalDay:m.intervalDay||1,timeStart:range[0],timeEnd:range[1],weekdays:decode(m.weekdays),daysOfMonth:decode(m.daysOfMonth),cron:m.cron||'0 2 * * *',durationMinutes:(m.duration||1800)/60,monitorIds:(m.monitors||[]).map((row:any)=>row.monitorId??row.id),statusPageIds:(m.statusPages||[]).map((row:any)=>row.statusPageId??row.id)});metadata.value=(m.monitors||[]).map((row:any)=>row.monitor||row)},{immediate:true})
const {data:pageOptions}=await useFetch<any>('/api/v1/status-pages',{headers:useRequestHeaders(['cookie'])})
const statusPages=computed(()=>{const map=new Map<number,any>();for(const row of props.maintenance?.statusPages||[])map.set(row.statusPageId,row.statusPage);for(const row of pageOptions.value?.data||[])map.set(row.id,row);return [...map.values()]})
const strategies=[['manual','Manual'],['single','Single window'],['recurring-interval','Every N days'],['recurring-weekday','Weekdays'],['recurring-day-of-month','Days of month'],['cron','Cron']]
async function save(){busy.value=true;error.value='';try{
 const body={title:form.title,description:form.description,strategy:form.strategy,active:form.active,timezone:form.timezone,startDate:form.startDate?new Date(form.startDate).toISOString():null,endDate:form.endDate?new Date(form.endDate).toISOString():null,intervalDay:Number(form.intervalDay),timeRange:[form.timeStart,form.timeEnd],weekdays:form.weekdays,daysOfMonth:form.daysOfMonth,cron:form.cron,duration:Math.round(Number(form.durationMinutes)*60),monitorIds:form.monitorIds,statusPageIds:form.statusPageIds}
 const response:any=await $fetch(props.maintenance?`/api/v1/maintenances/${props.maintenance.id}`:'/api/v1/maintenances',{method:props.maintenance?'PUT':'POST',body});emit('saved',response.data)
}catch(e:any){error.value=e.data?.message||'Unable to save maintenance'}finally{busy.value=false}}
</script>
<template>
 <form class="space-y-5 min-w-0" @submit.prevent="save">
  <p v-if="error" role="alert" class="rounded-lg bg-red-500/10 p-3 text-red-400">{{error}}</p>
  <label class="block">Title<input v-model="form.title" aria-label="Maintenance title" class="form-control mt-1" maxlength="200" required /></label>
  <label class="block">Description<textarea v-model="form.description" aria-label="Maintenance description" class="form-control mt-1" rows="2" /></label>
  <div class="grid sm:grid-cols-2 gap-4">
   <label>Strategy<select v-model="form.strategy" aria-label="Maintenance strategy" class="form-control mt-1"><option v-for="[value,label] in strategies" :key="value" :value="value">{{label}}</option></select></label>
   <label>Timezone<input v-model="form.timezone" aria-label="Maintenance timezone" class="form-control mt-1" placeholder="UTC or Asia/Taipei" required /></label>
  </div>
  <label class="flex items-center gap-2"><input v-model="form.active" type="checkbox" /> Enabled</label>
  <div v-if="form.strategy!=='manual'" class="grid sm:grid-cols-2 gap-4">
   <label>Start date<input v-model="form.startDate" type="datetime-local" aria-label="Maintenance start date" class="form-control mt-1" :required="['single','recurring-interval'].includes(form.strategy)" /></label>
   <label>End date<input v-model="form.endDate" type="datetime-local" aria-label="Maintenance end date" class="form-control mt-1" :required="form.strategy==='single'" /></label>
  </div>
  <div v-if="form.strategy.startsWith('recurring-')" class="grid sm:grid-cols-2 gap-4">
   <label>Daily start<input v-model="form.timeStart" type="time" aria-label="Daily start" class="form-control mt-1" required /></label>
   <label>Daily end<input v-model="form.timeEnd" type="time" aria-label="Daily end" class="form-control mt-1" required /></label>
  </div>
  <label v-if="form.strategy==='recurring-interval'" class="block">Every N days<input v-model.number="form.intervalDay" type="number" min="1" max="365" class="form-control mt-1" /></label>
  <fieldset v-if="form.strategy==='recurring-weekday'"><legend class="mb-2">Weekdays</legend><div class="flex flex-wrap gap-3"><label v-for="(day,index) in ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']" :key="day" class="flex gap-1"><input v-model="form.weekdays" type="checkbox" :value="index" />{{day}}</label></div></fieldset>
  <fieldset v-if="form.strategy==='recurring-day-of-month'"><legend class="mb-2">Days of month</legend><div class="grid grid-cols-7 gap-2"><label v-for="day in 31" :key="day" class="flex gap-1"><input v-model="form.daysOfMonth" type="checkbox" :value="day" />{{day}}</label><label class="col-span-3"><input v-model="form.daysOfMonth" type="checkbox" value="lastDay1" /> Last day</label></div></fieldset>
  <div v-if="form.strategy==='cron'" class="grid sm:grid-cols-2 gap-4"><label>Cron expression<input v-model="form.cron" aria-label="Cron expression" class="form-control mt-1" required /></label><label>Duration (minutes)<input v-model.number="form.durationMinutes" type="number" min="1" max="10080" aria-label="Duration minutes" class="form-control mt-1" /></label></div>
  <div><h2 class="font-medium mb-1">Affected monitors</h2><p class="text-sm text-gray-400 mb-2">Search the current environment. Existing selections from other environments remain selected. Empty means no monitors.</p><StatusPageMonitorSelector v-model="form.monitorIds" :monitors="metadata" /></div>
  <label class="block">Status pages<select v-model="form.statusPageIds" multiple aria-label="Affected status pages" class="form-control mt-1" size="3"><option v-for="page in statusPages" :key="page.id" :value="page.id">{{page.title}}</option></select></label>
  <div class="flex flex-wrap justify-end gap-3 pt-3"><button type="button" class="btn btn-secondary" @click="emit('cancel')">Cancel</button><button v-if="canEdit" type="submit" class="btn btn-primary" :disabled="busy">{{busy?'Saving…':props.maintenance?'Update maintenance':'Create maintenance'}}</button></div>
 </form>
</template>
