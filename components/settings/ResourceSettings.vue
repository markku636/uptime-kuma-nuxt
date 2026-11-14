<script setup lang="ts">
const props=defineProps<{kind:'notification'|'proxy'|'dockerHost'|'remoteBrowser';title:string}>()
const {canEdit}=useWorkspace(),rows=ref<any[]>([]),loading=ref(true),saving=ref(false),editing=ref<any>(),open=ref(false),message=ref('')
const paths={notification:'notifications',proxy:'proxies',dockerHost:'docker-hosts',remoteBrowser:'remote-browsers'}
async function load(){loading.value=true;try{const response:any=await $fetch(`/api/v1/${paths[props.kind]}`);rows.value=Array.isArray(response)?response:response.data||[]}catch{message.value='Unable to load resources'}finally{loading.value=false}}
onMounted(load)
function edit(row?:any){if(saving.value)return;editing.value=row;open.value=true;message.value=''}
async function save(input:any){saving.value=true;try{await $fetch(`/api/v1/${paths[props.kind]}${editing.value?'/'+editing.value.id:''}`,{method:editing.value?'PUT':'POST',body:input});open.value=false;message.value='Resource saved';await load()}catch(error:any){message.value=error.data?.message||'Unable to save resource'}finally{saving.value=false}}
async function remove(id:number){if(!confirm('Delete this resource?'))return;try{await $fetch(`/api/v1/${paths[props.kind]}/${id}`,{method:'DELETE'});await load()}catch{message.value='Unable to delete resource'}}
async function test(id:number){try{const response:any=await $fetch(`/api/v1/${paths[props.kind]}/test`,{method:'POST',body:{id}});message.value=response.code}catch(error:any){message.value=error.data?.message||'CONNECTION_FAILED'}}
</script>
<template>
<div class="space-y-5">
  <div class="flex justify-between items-center gap-4"><h2 class="text-xl font-semibold">{{title}}</h2><button v-if="canEdit" class="btn btn-primary" @click="edit()">Add resource</button></div>
  <p class="text-sm">Credentials and endpoint settings stay private. Editors can use and replace stored configuration.</p>
  <p v-if="message" role="status">{{message}}</p><p v-if="loading">Loading…</p>
  <div v-else class="overflow-auto"><table class="table"><thead><tr><th>Name / ID</th><th>Type</th><th>Status</th><th>Configuration</th><th v-if="canEdit">Actions</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id"><td>{{row.name||'Proxy #'+row.id}}</td><td>{{row.type||row.protocol||row.dockerType||'Browser'}}</td><td>{{row.active?'Active':'Inactive'}}</td><td>{{Object.values(row.configured||{}).some(Boolean)?'Configured':'Not configured'}}</td><td v-if="canEdit" class="space-x-2"><button class="btn btn-secondary" @click="edit(row)">Edit</button><button v-if="kind!=='proxy'" class="btn btn-secondary" @click="test(row.id)">Test</button><button class="btn btn-danger" @click="remove(row.id)">Delete</button></td></tr></tbody></table></div>
  <div v-if="open&&canEdit" class="section-card"><h3 class="font-semibold mb-4">{{editing?'Edit resource':'Add resource'}}</h3><SettingsResourceEditor :key="editing?.id||'new'" :kind="kind" :resource="editing" :loading="saving" @save="save" @cancel="open=false" /></div>
</div>
</template>
