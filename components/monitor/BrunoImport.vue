<script setup lang="ts">
import type {BrunoFile} from '../../shared/types/bruno'
const {current,environment,canEdit,canManage}=useWorkspace()
const files=ref<BrunoFile[]>([]),collectionId=ref('collection'),sourceEnvironment=ref(''),mode=ref<'create'|'replace'|'skip'>('create')
const variablesText=ref(''),secretsText=ref(''),busy=ref(false),error=ref(''),preview=ref<any>(null),completed=ref<any>(null),ignored=ref(0)
const previewPage=ref(0)
const previewRows=computed(()=>preview.value?.requests.slice(previewPage.value*100,(previewPage.value+1)*100)||[])
const manifestUpload=ref<HTMLInputElement|null>(null)
watch([()=>current.value?.id,()=>environment.value?.id],([workspaceId,environmentId],[oldWorkspace,oldEnvironment])=>{if(oldWorkspace!==undefined&&(workspaceId!==oldWorkspace||environmentId!==oldEnvironment)){files.value=[];preview.value=null;completed.value=null;variablesText.value='';secretsText.value='';sourceEnvironment.value='';for(const input of [upload.value,manifestUpload.value])if(input)input.value=''}})
const upload=ref<HTMLInputElement|null>(null),exportIds=ref('')
const environments=computed(()=>files.value.filter(file=>/^environments\/[^/]+\.bru$/.test(file.path)).map(file=>file.path))
watch([collectionId,sourceEnvironment,mode,variablesText,secretsText,files],()=>{preview.value=null;completed.value=null;previewPage.value=0},{deep:true})
function record(text:string){
  if(!text.trim())return undefined
  let value:any;try{value=JSON.parse(text)}catch{throw new Error('Variables must be a JSON object containing string values.')}
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.values(value).some(item=>typeof item!=='string'))throw new Error('Variables must be a JSON object containing string values.')
  return value as Record<string,string>
}
function manifest(){return {collectionId:collectionId.value,sourceEnvironment:sourceEnvironment.value||undefined,mode:mode.value,files:files.value,variables:record(variablesText.value),secrets:record(secretsText.value)}}
async function choose(event:Event){
  error.value='';preview.value=null;completed.value=null
  const selected=Array.from((event.target as HTMLInputElement).files||[])
  try{
    if(selected.length===1&&selected[0]!.name.endsWith('.json')&&selected[0]!.name!=='bruno.json'){
      if(selected[0]!.size>24*1024*1024)throw new Error('Manifest exceeds 24 MiB.')
      let input:any;try{input=JSON.parse(await selected[0]!.text())}catch{throw new Error('Invalid Bruno manifest JSON.')}
      if(!Array.isArray(input.files)||input.files.some((file:any)=>typeof file.path!=='string'||typeof file.content!=='string'))throw new Error('Manifest requires files with relative paths and text content.')
      files.value=input.files;collectionId.value=input.collectionId||'collection';sourceEnvironment.value=input.sourceEnvironment||'';mode.value='create';ignored.value=0;return
    }
    const accepted=selected.filter(file=>file.name.endsWith('.bru')||file.name==='bruno.json')
    ignored.value=selected.length-accepted.length
    if(accepted.length>4500||accepted.reduce((sum,file)=>sum+file.size,0)>20*1024*1024||accepted.some(file=>file.size>131072))throw new Error('Limit: 4500 files, 20 MiB total, 128 KiB each.')
    const root=accepted[0]?.webkitRelativePath?.split('/')[0]
    const entries:BrunoFile[]=[]
    for(const file of accepted){let path=file.webkitRelativePath||file.name;if(root&&path.startsWith(root+'/'))path=path.slice(root.length+1);entries.push({path,content:await file.text()})}
    files.value=entries;sourceEnvironment.value=''
  }catch(cause){error.value=(cause as Error).message;files.value=[]}
}
async function inspect(){
  if(!canEdit.value)return
  busy.value=true;error.value='';completed.value=null
  try{preview.value=await $fetch('/api/v1/bruno/preview',{method:'POST',body:manifest()})}
  catch(cause:any){error.value=cause.data?.message||'Preview failed'}finally{busy.value=false}
}
async function commit(){
  if(!preview.value?.ok||!canEdit.value)return
  busy.value=true;error.value=''
  try{const result=await $fetch('/api/v1/bruno/import',{method:'POST',body:{...manifest(),digest:preview.value.digest}});preview.value=null;secretsText.value='';variablesText.value='';files.value=[];if(upload.value)upload.value.value='';await nextTick();completed.value=result}
  catch(cause:any){error.value=cause.data?.message||'Import failed';preview.value=null}finally{busy.value=false}
}
async function download(){
  busy.value=true;error.value=''
  try{
    const response=await $fetch<any>('/api/v1/bruno/export',{query:exportIds.value?{ids:exportIds.value}:undefined})
    const blob=new Blob([JSON.stringify(response.data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a')
    link.href=url;link.download='bruno-manifest.json';link.click();URL.revokeObjectURL(url)
  }catch(cause:any){error.value=cause.data?.data?.code||cause.data?.message||'Export failed'}finally{busy.value=false}
}
</script>
<template>
  <div class="space-y-6">
    <div class="section-card space-y-3">
      <h2 class="text-xl font-semibold">Bruno declarative import</h2>
      <p>Target: {{ current?.name }} / {{ environment?.name }}. Imports are atomic and paused. Scripts, tests, runtime variables and unsupported settings are rejected.</p>
      <p class="text-sm text-muted">Supports HTTP, headers/query, JSON/text, basic/bearer, static variables and typed assertions. Maximum 4000 requests, 4500 files, 20 MiB source total and 128 KiB per file. Parsing has a 10-second budget.</p>
      <p v-if="!canEdit" role="status">Editor access is required.</p>
      <label class="block">Collection identity<input v-model="collectionId" class="input-field" :disabled="busy||!canEdit" placeholder="stable-collection-id"></label>
      <p class="text-sm text-muted">Identity uses collection, source path and source environment within this target. Display names never select an existing monitor for replacement.</p>
      <label class="block">Collection directory<input ref="upload" type="file" multiple webkitdirectory class="input-field" :disabled="busy||!canEdit" @change="choose"></label>
      <label class="block">Or exported manifest JSON<input ref="manifestUpload" type="file" accept=".json" class="input-field" :disabled="busy||!canEdit" @change="choose"></label>
      <p>{{ files.length }} source files selected<span v-if="ignored">; {{ ignored }} files outside .bru/bruno.json ignored</span>.</p>
      <label class="block">Source environment<select aria-label="Source environment" v-model="sourceEnvironment" class="select-field" :disabled="busy"><option value="">Use existing target environment</option><option v-for="path in environments" :key="path" :value="path">{{ path }}</option></select></label>
      <label class="block">Existing source policy<select aria-label="Existing source policy" v-model="mode" class="select-field" :disabled="busy"><option value="create">Create — reject existing identities</option><option value="skip">Skip existing identities</option><option value="replace">Replace matching identities and pause</option></select></label>
      <label class="block">Static variable overrides (JSON object)<textarea v-model="variablesText" class="input-field font-mono" rows="3" :disabled="busy" placeholder='{"origin":"http://localhost:8080"}' /></label>
      <label class="block">Secret values (JSON object, write-only)<textarea v-model="secretsText" class="input-field font-mono" rows="3" :disabled="busy" autocomplete="off" spellcheck="false" placeholder='{"token":"configure locally"}' /></label>
      <p class="text-sm text-muted">Changing target variables/secrets requires an owner session. Existing target values can be reused by editors. Preview never sends HTTP requests or writes data.</p>
      <button class="btn btn-primary" :disabled="busy||!canEdit||!files.length" @click="inspect">{{ busy?'Processing…':'Preview import' }}</button>
    </div>
    <p v-if="error" role="alert" class="text-red-500">{{ error }}</p>
    <div v-if="preview" class="section-card space-y-4" aria-live="polite">
      <h3 class="text-lg font-semibold">Preview</h3>
      <p>{{ preview.counts.requests }} requests · {{ preview.counts.create }} create · {{ preview.counts.replace }} replace · {{ preview.counts.skip }} skip</p>
      <p v-if="preview.missingSecrets?.length">Missing secrets: {{ preview.missingSecrets.join(', ') }}</p>
      <ul v-if="preview.issues.length" class="space-y-1 text-red-500"><li v-for="(issue,index) in preview.issues" :key="index">{{ issue.file||'Manifest' }} · {{ issue.code }}<span v-if="issue.field"> · {{ issue.field }}</span></li></ul>
      <p v-if="preview.environmentChanges">Target environment values will change in the same transaction.</p>
      <div class="overflow-auto max-h-96"><table class="w-full text-sm"><thead><tr><th class="text-left">Path / name</th><th>Method</th><th>Assertions</th><th>Action</th></tr></thead><tbody><tr v-for="row in previewRows" :key="row.path"><td>{{ row.path }}<br>{{ row.name }}</td><td class="text-center">{{ row.method }}</td><td class="text-center">{{ row.assertionCount }}</td><td class="text-center">{{ row.action }}</td></tr></tbody></table></div>
      <div v-if="preview.requests.length>100" class="flex items-center gap-3"><button class="btn btn-outline" :disabled="previewPage===0" @click="previewPage--">Previous</button><span>Page {{ previewPage+1 }} / {{ Math.ceil(preview.requests.length/100) }}</span><button class="btn btn-outline" :disabled="(previewPage+1)*100>=preview.requests.length" @click="previewPage++">Next</button></div>
      <button class="btn btn-primary" :disabled="busy||!preview.ok" @click="commit">Import paused monitors</button>
    </div>
    <div v-if="completed" class="section-card space-y-3" role="status"><h3 class="font-semibold">Import complete — monitors paused</h3><p>{{ completed.data.createdIds.length }} created · {{ completed.data.replacedIds.length }} replaced · {{ completed.data.skippedIds.length }} skipped.</p><NuxtLink to="/dashboard" class="link">Open dashboard</NuxtLink></div>
    <div v-if="canManage" class="section-card space-y-3"><h3 class="font-semibold">Export supported requests</h3><p class="text-sm">Export uses secret placeholders and includes header names/assertion definitions. Up to 20 monitors and 200 placeholders; nondefault timeout/transport or unrepresentable assertions are rejected. Scheduling and associations are excluded.</p><label class="block">Monitor IDs (comma-separated; blank selects this environment)<input v-model="exportIds" class="input-field" placeholder="12,13"></label><button class="btn btn-outline" :disabled="busy" @click="download">Download Bruno manifest</button></div>
  </div>
</template>
