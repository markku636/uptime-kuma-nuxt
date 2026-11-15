<template>
  <div class="space-y-8 max-w-3xl">
    <p class="text-muted">Workspaces separate monitors and settings. Each monitor belongs to one environment.</p>
    <p v-if="error" role="alert" class="text-red-500">{{ error }}</p>
    <p v-if="notice" role="status" class="text-green-500">{{ notice }}</p>
    <form class="flex flex-wrap gap-3" @submit.prevent="createWorkspace">
      <input v-model="workspaceName" required maxlength="100" class="field" placeholder="New workspace name" aria-label="New workspace name">
      <UButton type="submit" :loading="busy">Create workspace</UButton>
    </form>
    <section v-if="current" class="space-y-4">
      <h2 class="text-lg font-semibold">{{ current.name }} <span class="text-sm text-muted">{{ current.role }}</span></h2>
      <p v-if="!canManage" class="text-muted">Workspace owners manage members and environment variables.</p>
      <template v-if="canManage">
        <h3 class="font-medium">Members</h3>
        <div v-for="member in members" :key="member.userId" class="flex items-center justify-between gap-3 border-b border-current/10 py-2">
          <span>{{ member.user.username }} · {{ member.role }}</span>
          <UButton color="neutral" variant="ghost" size="sm" :disabled="busy" @click="removeMember(member.userId)">Remove</UButton>
        </div>
        <form class="flex flex-wrap gap-3" @submit.prevent="saveMember">
          <input v-model="memberName" required class="field" placeholder="Existing account username" aria-label="Member username">
          <select v-model="memberRole" class="field" aria-label="Member role"><option>viewer</option><option>editor</option><option>owner</option></select>
          <UButton type="submit" :loading="busy">Add / update member</UButton>
        </form>
        <h3 class="font-medium pt-4">Environments</h3>
        <form class="flex flex-wrap gap-3" @submit.prevent="createEnvironment">
          <input v-model="environmentName" required maxlength="100" class="field" placeholder="New environment name" aria-label="New environment name">
          <UButton type="submit" :loading="busy">Create environment</UButton>
        </form>
        <select v-model="editingEnvironmentId" class="field" aria-label="Edit environment" @change="selectEditingEnvironment">
          <option v-for="item in environments" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
        <form class="space-y-3" @submit.prevent="saveVariables">
          <label class="block">Static variables (JSON object)<textarea v-model="variables" class="field mt-2 min-h-32 w-full font-mono" aria-label="Static environment variables" /></label>
          <p class="text-sm text-muted">Use <code v-pre>{{variableName}}</code> in request URLs, headers and bodies. Secret values are encrypted and never returned.</p>
          <div class="flex flex-wrap gap-3">
            <input v-model="secretName" class="field" placeholder="Secret variable name" aria-label="Secret variable name">
            <input v-model="secretValue" type="password" autocomplete="new-password" class="field" placeholder="New secret value" aria-label="Secret variable value">
          </div>
          <p class="text-sm text-muted">Saved secrets: {{ selectedEnvironment?.secretNames.join(', ') || 'None' }}</p>
          <UButton type="submit" :loading="busy">Save variables</UButton>
        </form>
        <div v-if="selectedEnvironment?.secretNames.length" class="flex flex-wrap gap-2">
          <UButton v-for="name in selectedEnvironment.secretNames" :key="name" color="neutral" variant="soft" size="sm" @click="deleteSecret(name)">Remove {{ name }}</UButton>
        </div>
      </template>
    </section>
    <section v-if="platformAdmin" class="space-y-3 border-t border-current/10 pt-6">
      <h2 class="text-lg font-semibold">Create an account</h2>
      <form class="flex flex-wrap gap-3" @submit.prevent="createAccount">
        <input v-model="accountName" required minlength="3" class="field" placeholder="Username" aria-label="Account username">
        <input v-model="accountPassword" required minlength="12" type="password" autocomplete="new-password" class="field" placeholder="Password (12+ characters)" aria-label="Account password">
        <UButton type="submit" :loading="busy">Create account</UButton>
      </form>
    </section>
  </div>
</template>
<script setup lang="ts">
const { current, canManage, load, change } = useWorkspace()
interface Environment { id: number; name: string; variables: Record<string,string>; secretNames: string[] }
const members = ref<{ userId: number; role: string; user: { username: string } }[]>([])
const environments = ref<Environment[]>([]), editingEnvironmentId = ref<number>(), variables = ref('{}')
const selectedEnvironment = computed(() => environments.value.find(e => e.id === Number(editingEnvironmentId.value)))
const workspaceName = ref(''), environmentName = ref(''), memberName = ref(''), memberRole = ref('viewer')
const secretName = ref(''), secretValue = ref(''), accountName = ref(''), accountPassword = ref('')
const platformAdmin = ref(false), busy = ref(false), error = ref(''), notice = ref('')
const base = computed(() => `/api/v1/workspaces/${current.value?.id}`)
function selectEditingEnvironment() { variables.value = JSON.stringify(selectedEnvironment.value?.variables || {}, null, 2); secretName.value = ''; secretValue.value = '' }
let refreshSequence=0
async function refresh() {
  const sequence=++refreshSequence,id=current.value?.id,owner=canManage.value
  if(!id)return
  const basePath=`/api/v1/workspaces/${id}`
  const [environmentResponse,memberResponse]=await Promise.all([$fetch<{data:Environment[]}>(`${basePath}/environments`),owner?$fetch<{data:typeof members.value}>(`${basePath}/members`):Promise.resolve({data:[]})])
  if(sequence!==refreshSequence||current.value?.id!==id)return
  environments.value=environmentResponse.data;members.value=memberResponse.data
  if(!environments.value.some(e=>e.id===editingEnvironmentId.value))editingEnvironmentId.value=environments.value[0]?.id
  selectEditingEnvironment()
}
watch(()=>current.value?.id,(id,previous)=>{
 if(id===previous)return
 ++refreshSequence;members.value=[];environments.value=[];editingEnvironmentId.value=undefined;variables.value='{}';secretName.value='';secretValue.value='';error.value='';notice.value=''
 if(import.meta.client&&previous)void refresh().catch(()=>{if(current.value?.id===id)error.value='Unable to load workspace'})
},{flush:'sync'})
async function act(action:()=>Promise<unknown>){
 const id=current.value?.id;busy.value=true;error.value='';notice.value=''
 try{await action();await load();if(current.value?.id===id){await refresh();notice.value='Saved'}}catch(e:any){if(current.value?.id===id)error.value=e?.data?.message||'Unable to save'}finally{busy.value=false}
}
async function createWorkspace() { await act(async () => { const response = await $fetch<{ data: { id: number } }>('/api/v1/workspaces', { method: 'POST', body: { name: workspaceName.value } }); await load(); change(response.data.id) }) }
async function saveMember() { await act(() => $fetch(`${base.value}/members`, { method: 'POST', body: { username: memberName.value, role: memberRole.value } })) }
async function removeMember(id: number) { await act(() => $fetch(`${base.value}/members/${id}`, { method: 'DELETE' })) }
async function createEnvironment() { await act(async () => { await $fetch(`${base.value}/environments`, { method: 'POST', body: { name: environmentName.value } }); environmentName.value = '' }) }
async function saveVariables() { await act(async () => {
  const values = JSON.parse(variables.value)
  if (!values || Array.isArray(values) || typeof values !== 'object' || Object.values(values).some(v => typeof v !== 'string')) throw new Error('Variables must be a JSON object of strings')
  await $fetch(`${base.value}/environments/${editingEnvironmentId.value}`, { method: 'PUT', body: { variables: values,
    ...(secretName.value ? { secrets: { [secretName.value]: secretValue.value } } : {}) } }); secretName.value = ''; secretValue.value = ''
}) }
async function deleteSecret(name: string) { await act(() => $fetch(`${base.value}/environments/${editingEnvironmentId.value}`, { method: 'PUT', body: { secrets: { [name]: null } } })) }
async function createAccount() { await act(async () => { await $fetch('/api/v1/users', { method: 'POST', body: { username: accountName.value, password: accountPassword.value } }); accountName.value = ''; accountPassword.value = '' }) }
onMounted(async()=>{try{await load();await refresh();platformAdmin.value=!!(await $fetch<{data?:{platformAdmin?:boolean}}>('/api/auth/session')).data?.platformAdmin}catch{error.value='Unable to load workspace'}})
</script>
<style scoped>
.field { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: .5rem; background: transparent; padding: .6rem .8rem; }
</style>
