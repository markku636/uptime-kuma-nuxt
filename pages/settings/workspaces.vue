<template>
  <div class="space-y-6 max-w-6xl">
    <div class="card card-body">
      <h2 class="text-lg font-semibold">Workspaces</h2>
      <p class="text-sm text-secondary mt-1">Workspaces separate monitors and settings. Each monitor belongs to one environment.</p>
      <p v-if="error" role="alert" class="text-red-500 text-sm mt-3">{{ error }}</p>
      <p v-if="notice" role="status" class="text-emerald-500 text-sm mt-3">{{ notice }}</p>
      <form class="flex flex-wrap gap-3 mt-4" @submit.prevent="createWorkspace">
        <input v-model="workspaceName" required maxlength="100" class="field flex-1 min-w-52" placeholder="New workspace name" aria-label="New workspace name">
        <UButton type="submit" :loading="busy">Create workspace</UButton>
      </form>
    </div>

    <template v-if="current">
      <div class="card card-body">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-lg font-semibold">{{ current.name }}</h2>
          <span class="text-xs text-secondary rounded-full border border-current/15 px-2 py-0.5">{{ current.role }}</span>
        </div>
        <p v-if="!canManage" class="text-sm text-secondary mt-2">Workspace owners manage members and environment variables.</p>

        <template v-if="canManage">
          <div class="mt-6">
            <h3 class="font-medium mb-2">Members</h3>
            <div v-for="member in members" :key="member.userId" class="flex items-center justify-between gap-3 border-b border-current/10 py-2 text-sm">
              <span>{{ member.user.username }} · <span class="text-secondary">{{ member.role }}</span></span>
              <UButton color="neutral" variant="ghost" size="sm" :disabled="busy" @click="removeMember(member.userId)">Remove</UButton>
            </div>
            <form class="flex flex-wrap gap-3 mt-3" @submit.prevent="saveMember">
              <input v-model="memberName" required class="field flex-1 min-w-48" placeholder="Existing account username" aria-label="Member username">
              <select v-model="memberRole" class="field" aria-label="Member role"><option>viewer</option><option>editor</option><option>owner</option></select>
              <UButton type="submit" :loading="busy">Add / update member</UButton>
            </form>
          </div>

          <div class="mt-6">
            <h3 class="font-medium mb-2">Environments</h3>
            <form class="flex flex-wrap gap-3" @submit.prevent="createEnvironment">
              <input v-model="environmentName" required maxlength="100" class="field flex-1 min-w-48" placeholder="New environment name" aria-label="New environment name">
              <UButton type="submit" :loading="busy">Create environment</UButton>
            </form>
            <select v-model.number="editingEnvironmentId" class="field mt-3 min-w-52" aria-label="Edit environment" @change="selectEditingEnvironment">
              <option v-for="item in environments" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </div>

          <form class="mt-6 space-y-4" @submit.prevent="saveVariables">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="font-medium">Environment variables</h3>
                <p class="text-xs text-secondary mt-1">Use <code v-pre>{{variableName}}</code> in URLs, headers and bodies. Values are stored as a JSON object.</p>
              </div>
              <div class="flex items-center gap-3">
                <button type="button" class="text-xs text-primary hover:underline" @click="selectEditingEnvironment()">Reset changes</button>
                <button type="button" class="text-xs text-primary hover:underline" @click="rawMode = !rawMode">
                  {{ rawMode ? 'Use key/value editor' : 'Edit JSON directly' }}
                </button>
              </div>
            </div>

            <div v-if="!rawMode" class="space-y-2">
              <div v-for="(row, index) in variableRows" :key="index" class="flex flex-wrap gap-2 items-center">
                <div class="flex-1 min-w-40">
                  <input v-model="row.key" class="field w-full" placeholder="VARIABLE_NAME" :aria-label="`Variable name ${index + 1}`">
                  <p v-if="row.key.trim() && !isValidVariableName(row.key.trim())" class="text-xs text-red-500 mt-1">Invalid variable name</p>
                </div>
                <input v-model="row.value" class="field flex-[2] min-w-48" placeholder="value" :aria-label="`Variable value ${index + 1}`">
                <UButton type="button" color="neutral" variant="ghost" size="sm" :disabled="!row.key.trim()" :aria-label="`Copy token for variable ${index + 1}`" @click="copyToken(row.key)">Copy token</UButton>
                <UButton type="button" color="neutral" variant="ghost" size="sm" :aria-label="`Remove variable ${index + 1}`" @click="variableRows.splice(index, 1)">Remove</UButton>
              </div>
              <UButton type="button" color="neutral" variant="soft" size="sm" @click="variableRows.push({ key: '', value: '' })">+ Add variable</UButton>
            </div>
            <textarea v-else v-model="rawJson" class="field min-h-32 w-full font-mono" aria-label="Static environment variables" spellcheck="false" />

            <div class="border-t border-current/10 pt-4">
              <label class="text-xs text-secondary" for="settings-env-preview">Preview placeholders</label>
              <input id="settings-env-preview" v-model="previewText" class="field w-full mt-1" placeholder="&#123;&#123;baseUrl&#125;&#125;/health">
              <p v-if="previewResult" class="text-xs mt-1" :class="previewResult.missing.length ? 'text-amber-500' : 'text-emerald-500'">
                Resolved: <code class="break-all">{{ previewResult.preview }}</code><span v-if="previewResult.missing.length"> · Unknown: {{ previewResult.missing.join(', ') }}</span>
              </p>
            </div>

            <div class="border-t border-current/10 pt-4">
              <h4 class="font-medium text-sm">Secrets</h4>
              <p class="text-xs text-secondary mt-1">Secret values are encrypted and never returned after saving.</p>
              <div class="flex flex-wrap gap-3 mt-2">
                <input v-model="secretName" class="field flex-1 min-w-40" placeholder="Secret variable name" aria-label="Secret variable name">
                <input v-model="secretValue" type="password" autocomplete="new-password" class="field flex-1 min-w-40" placeholder="New secret value" aria-label="Secret variable value">
              </div>
              <div v-if="selectedEnvironment?.secretNames.length" class="flex flex-wrap gap-2 mt-3">
                <UButton v-for="name in selectedEnvironment.secretNames" :key="name" type="button" color="neutral" variant="soft" size="sm" @click="deleteSecret(name)">Remove {{ name }}</UButton>
              </div>
              <p v-else class="text-xs text-secondary mt-3">No secrets configured.</p>
            </div>

            <UButton type="submit" :loading="busy">Save variables</UButton>
          </form>
        </template>
      </div>
    </template>

    <div v-if="platformAdmin" class="card card-body">
      <h2 class="text-lg font-semibold">Create an account</h2>
      <form class="flex flex-wrap gap-3 mt-4" @submit.prevent="createAccount">
        <input v-model="accountName" required minlength="3" class="field flex-1 min-w-40" placeholder="Username" aria-label="Account username">
        <input v-model="accountPassword" required minlength="12" type="password" autocomplete="new-password" class="field flex-1 min-w-48" placeholder="Password (12+ characters)" aria-label="Account password">
        <UButton type="submit" :loading="busy">Create account</UButton>
      </form>
    </div>
  </div>
</template>
<script setup lang="ts">
import { isValidVariableName, useEnvironmentVariables, validateVariableMap } from '~/composables/useEnvironmentVariables'
import { previewEnvironmentVariables } from '~/utils/variable-preview'

const route = useRoute()
const { current, canManage, load, change } = useWorkspace()
const { environments, load: loadEnvironments, selected: selectedEnvironmentOf, saveEnvironment, reset: resetEnvironments } = useEnvironmentVariables()
const members = ref<{ userId: number; role: string; user: { username: string } }[]>([])
const editingEnvironmentId = ref<number>()
const variableRows = ref<{ key: string; value: string }[]>([])
const rawJson = ref('{}'), rawMode = ref(false)
const selectedEnvironment = selectedEnvironmentOf(editingEnvironmentId)
const previewText = ref('')
const previewResult = computed(() => {
  const text = previewText.value
  if (!text?.includes('{{')) return null
  const variables: Record<string, string> = {}
  if (rawMode.value) {
    try { Object.assign(variables, validateVariableMap(JSON.parse(rawJson.value), {checkNames: false})) } catch { /* show missing placeholders */ }
  } else {
    for (const row of variableRows.value) if (row.key.trim()) variables[row.key.trim()] = row.value
  }
  return previewEnvironmentVariables(text, variables, selectedEnvironment.value?.secretNames || [])
})

async function copyToken(name: string) {
  const token = `{{${name.trim()}}}`
  try { await navigator.clipboard.writeText(token); notice.value = `Copied ${token}` }
  catch { error.value = 'Clipboard unavailable; select and copy the name manually.' }
}
const workspaceName = ref(''), environmentName = ref(''), memberName = ref(''), memberRole = ref('viewer')
const secretName = ref(''), secretValue = ref(''), accountName = ref(''), accountPassword = ref('')
const platformAdmin = ref(false), busy = ref(false), error = ref(''), notice = ref('')
const base = computed(() => `/api/v1/workspaces/${current.value?.id}`)

function selectEditingEnvironment() {
  const values = selectedEnvironment.value?.variables || {}
  variableRows.value = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }))
  if (!variableRows.value.length) variableRows.value = [{ key: '', value: '' }]
  rawJson.value = JSON.stringify(values, null, 2)
  secretName.value = ''; secretValue.value = ''
}

let refreshSequence = 0
async function refresh() {
  const sequence = ++refreshSequence, id = current.value?.id, owner = canManage.value
  if (!id) return
  const basePath = `/api/v1/workspaces/${id}`
  const [, memberResponse] = await Promise.all([
    loadEnvironments(id),
    owner ? $fetch<{ data: typeof members.value }>(`${basePath}/members`) : Promise.resolve({ data: [] }),
  ])
  if (sequence !== refreshSequence || current.value?.id !== id) return
  members.value = memberResponse.data
  const requested = Number(route.query.environment)
  const requestedExists = environments.value.some(e => e.id === requested)
  if (requestedExists) editingEnvironmentId.value = requested
  else if (!environments.value.some(e => e.id === editingEnvironmentId.value)) editingEnvironmentId.value = environments.value[0]?.id
  selectEditingEnvironment()
}

watch(() => current.value?.id, (id, previous) => {
  if (id === previous) return
  ++refreshSequence; members.value = []; resetEnvironments(); editingEnvironmentId.value = undefined
  variableRows.value = []; rawJson.value = '{}'; rawMode.value = false
  secretName.value = ''; secretValue.value = ''; error.value = ''; notice.value = ''
  if (import.meta.client && previous) void refresh().catch(() => { if (current.value?.id === id) error.value = 'Unable to load workspace' })
}, { flush: 'sync' })

async function act(action: () => Promise<unknown>) {
  const id = current.value?.id; busy.value = true; error.value = ''; notice.value = ''
  try { await action(); await load(); if (current.value?.id === id) { await refresh(); notice.value = 'Saved' } }
  catch (e: any) { if (current.value?.id === id) error.value = e?.data?.message || e?.message || 'Unable to save' }
  finally { busy.value = false }
}

async function createWorkspace() { await act(async () => { const response = await $fetch<{ data: { id: number } }>('/api/v1/workspaces', { method: 'POST', body: { name: workspaceName.value } }); await load(); change(response.data.id) }) }
async function saveMember() { await act(() => $fetch(`${base.value}/members`, { method: 'POST', body: { username: memberName.value, role: memberRole.value } })) }
async function removeMember(id: number) { await act(() => $fetch(`${base.value}/members/${id}`, { method: 'DELETE' })) }
async function createEnvironment() { await act(async () => { await $fetch(`${base.value}/environments`, { method: 'POST', body: { name: environmentName.value } }); environmentName.value = '' }) }

async function saveVariables() {
  const workspaceId = current.value?.id, environmentId = editingEnvironmentId.value
  if (!workspaceId || !environmentId) return
  await act(async () => {
    const values: Record<string, string> = {}
    if (rawMode.value) {
      // Raw JSON keeps the original behaviour: shape/string checks here, key syntax checked by the server.
      const parsed = JSON.parse(rawJson.value)
      Object.assign(values, validateVariableMap(parsed, { checkNames: false }))
    } else {
      for (const row of variableRows.value) {
        const key = row.key.trim()
        if (!key) continue
        if (!isValidVariableName(key)) throw new Error(`Invalid variable name: ${key}`)
        values[key] = String(row.value)
      }
    }
    await saveEnvironment(workspaceId, environmentId, {
      variables: values,
      ...(secretName.value ? { secrets: { [secretName.value]: secretValue.value } } : {}),
    }, { skipNameValidation: rawMode.value })
    secretName.value = ''; secretValue.value = ''
  })
}

async function deleteSecret(name: string) {
  const workspaceId = current.value?.id, environmentId = editingEnvironmentId.value
  if (!workspaceId || !environmentId) return
  await act(() => saveEnvironment(workspaceId, environmentId, { secrets: { [name]: null } }))
}
async function createAccount() { await act(async () => { await $fetch('/api/v1/users', { method: 'POST', body: { username: accountName.value, password: accountPassword.value } }); accountName.value = ''; accountPassword.value = '' }) }

onMounted(async () => {
  try {
    await load(); await refresh()
    platformAdmin.value = !!(await $fetch<{ data?: { platformAdmin?: boolean } }>('/api/auth/session')).data?.platformAdmin
  } catch { error.value = 'Unable to load workspace' }
})
</script>
<style scoped>
.field { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: .5rem; background: transparent; padding: .6rem .8rem; }
</style>
