<script setup lang="ts">
const props=defineProps<{kind:'notification'|'proxy'|'dockerHost'|'remoteBrowser';resource?:any;loading?:boolean}>()
const emit=defineEmits<{save:[input:any];cancel:[]}>()
const form=reactive<Record<string,any>>({}),clear=ref<string[]>([]),replaceConfig=ref(false),headers=ref('{}'),testing=ref(false),result=ref('')
const paths={notification:'notifications',proxy:'proxies',dockerHost:'docker-hosts',remoteBrowser:'remote-browsers'}
const secretFields=computed(()=>props.kind==='notification'?['config']:props.kind==='proxy'?['host','username','password']:props.kind==='dockerHost'?['dockerDaemon','connectionUrl']:['url'])
const configFields=computed(()=>form.type==='webhook'?[['url','Webhook URL'],['body','Custom body (optional)']]:form.type==='discord'?[['webhookUrl','Discord webhook URL'],['username','Bot display name'],['agentHint','Agent instruction (DOWN alerts only)'],['content','Message content (e.g. @mention)'],['monitorUrlBase','Monitor URL base (optional)']]:form.type==='slack'?[['webhookUrl','Slack webhook URL'],['channel','Channel']]:form.type==='telegram'?[['botToken','Bot token'],['chatId','Chat ID']]:form.type==='email'?[['to','Recipient emails (comma separated)']]:[['channelAccessToken','Channel access token'],['userId','User ID']])
const editing=computed(()=>!!props.resource?.id)
watch(()=>props.resource,()=>{
  for(const key of Object.keys(form))delete form[key]
  Object.assign(form,{name:'',active:true,type:'webhook',isDefault:false,protocol:'http',port:8080,auth:false,dockerType:'socket',config:{},...Object.fromEntries(Object.entries(props.resource||{}).filter(([key])=>!secretFields.value.includes(key)))})
  for(const key of secretFields.value)if(key!=='config')form[key]=''
  form.config={};clear.value=[];headers.value='{}';replaceConfig.value=!editing.value;result.value=''
},{immediate:true})
watch(()=>form.type,(next,previous)=>{if(previous!==undefined&&next!==previous){form.config={};headers.value='{}';replaceConfig.value=true}})
function payload(){
  const fields=props.kind==='notification'?['name','type','active','isDefault']:props.kind==='proxy'?['protocol','port','auth','active','isDefault']:props.kind==='dockerHost'?['name','dockerType','active']:['name','active']
  const input:any=Object.fromEntries(fields.map(key=>[key,form[key]]))
  if(props.kind==='notification'&&replaceConfig.value){input.config={...form.config};if(form.type==='webhook'){const parsed=JSON.parse(headers.value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('Headers must be a JSON object');input.config.headers=parsed}}
  for(const key of secretFields.value)if(key!=='config'&&(!editing.value||form[key]!==''))input[key]=form[key]
  if(clear.value.length)input.clearSecrets=[...clear.value]
  return input
}
function save(){try{result.value='';emit('save',payload())}catch{result.value='Invalid configuration JSON'}}
async function test(){testing.value=true;result.value='';try{
  const input=payload(),response:any=await $fetch(`/api/v1/${paths[props.kind]}/test`,{method:'POST',body:editing.value?{id:props.resource.id,overrides:input}:input})
  result.value=response.code||'CONNECTION_FAILED'
}catch(error:any){result.value=error.data?.message||'CONNECTION_FAILED'}finally{testing.value=false}}
</script>
<template>
<form class="space-y-4" @submit.prevent="save">
  <p class="text-sm">Stored credentials are write-only. Leave blank to keep them, enter replacement values, or select a field to clear.</p>
  <label v-if="kind!=='proxy'" class="block">Name<input v-model="form.name" aria-label="Name" required maxlength="200" class="input-field mt-1" /></label>
  <template v-if="kind==='notification'">
    <label class="block">Provider<select v-model="form.type" aria-label="Provider" class="select-field mt-1"><option v-for="value in ['webhook','discord','slack','telegram','line','email']" :key="value" :value="value">{{value}}</option><option v-if="!['webhook','discord','slack','telegram','line','email'].includes(form.type)" :value="form.type">{{form.type}} (unsupported)</option></select></label>
    <p class="text-sm">Supported delivery: webhook, Discord, Slack, Telegram, LINE Messaging API and email (requires operator-configured SMTP relay). Other providers are unavailable.</p>
    <label v-if="editing" class="flex gap-2"><input v-model="replaceConfig" type="checkbox" aria-label="Replace stored configuration" />Replace stored configuration</label>
    <fieldset v-if="replaceConfig" class="space-y-3">
      <label v-for="field in configFields" :key="field[0]" class="block">{{field[1]}}<input v-model="form.config[field[0]!]" :aria-label="field[1]" :type="/token/i.test(field[0]!)?'password':'text'" autocomplete="off" maxlength="8192" class="input-field mt-1" /></label>
      <label v-if="form.type==='discord'" class="flex gap-2 text-sm"><input v-model="form.config.mentionEveryone" type="checkbox" aria-label="Allow everyone mention" />Allow @everyone / @here (off by default)</label>
      <label v-if="form.type==='webhook'" class="block">Headers (JSON)<textarea v-model="headers" aria-label="Headers (JSON)" class="input-field mt-1" rows="3" maxlength="32768" /></label>
    </fieldset>
  </template>
  <template v-if="kind==='proxy'">
    <label class="block">Protocol<select v-model="form.protocol" aria-label="Protocol" class="select-field"><option v-for="value in ['http','https','socks','socks5']" :value="value">{{value}}</option></select></label>
    <label class="block">Port<input v-model.number="form.port" aria-label="Port" type="number" min="1" max="65535" class="input-field" /></label>
    <label class="flex gap-2"><input v-model="form.auth" type="checkbox" />Authentication</label>
  </template>
  <label v-if="kind==='dockerHost'" class="block">Connection type<select v-model="form.dockerType" aria-label="Connection type" class="select-field"><option value="socket">Socket</option><option value="tcp">TCP</option></select></label>
  <template v-if="kind!=='notification'">
    <div v-for="field in secretFields" :key="field">
      <label class="block">{{field}}<input v-model="form[field]" :aria-label="field" :type="field==='password'?'password':'text'" autocomplete="off" maxlength="8192" class="input-field mt-1" :placeholder="resource?.configured?.[field]?'Configured — leave blank to preserve':''" /></label>
      <label v-if="editing" class="flex gap-2 text-sm"><input v-model="clear" type="checkbox" :value="field" :aria-label="'Clear '+field" />Clear {{field}} <span v-if="resource?.configured?.[field]">(configured)</span></label>
    </div>
  </template>
  <label v-if="editing&&kind==='notification'" class="flex gap-2"><input v-model="clear" type="checkbox" value="config" aria-label="Clear config" />Clear stored configuration <span v-if="resource?.configured?.config">(configured)</span></label>
  <label class="flex gap-2"><input v-model="form.active" type="checkbox" aria-label="Active" />Active</label>
  <label v-if="kind==='notification'||kind==='proxy'" class="flex gap-2"><input v-model="form.isDefault" type="checkbox" />Default for this workspace</label>
  <p v-if="result" role="status">{{result}}</p>
  <div class="flex flex-wrap gap-2"><button class="btn btn-primary" type="submit" :disabled="loading">Save resource</button><button v-if="kind!=='proxy'" class="btn btn-secondary" type="button" :disabled="testing||loading" @click="test">{{testing?'Testing…':'Test connection'}}</button><button class="btn btn-secondary" type="button" @click="emit('cancel')">Cancel</button></div>
</form>
</template>
