<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const { current, canManage, environment, load } = useWorkspace()
const tab = ref<'variables' | 'keys'>('variables')

interface Environment { id: number; name: string; variables: Record<string, string>; secretNames: string[] }

// ---------- Environment variables ----------
const environments = ref<Environment[]>([])
const environmentId = ref<number>()
const rows = ref<{ key: string; value: string }[]>([])
const rawJson = ref('{}')
const rawMode = ref(false)
const secretName = ref('')
const secretValue = ref('')
const variablesLoading = ref(false)

const selectedEnvironment = computed(() => environments.value.find(item => item.id === environmentId.value))

async function loadEnvironments() {
  if (!current.value?.id) return
  variablesLoading.value = true
  try {
    const response = await $fetch<{ data: Environment[] }>(`/api/v1/workspaces/${current.value.id}/environments`)
    environments.value = response?.data || []
    if (!environments.value.some(item => item.id === environmentId.value)) environmentId.value = environments.value[0]?.id
    selectEnvironment()
  } catch {
    environments.value = []
  } finally {
    variablesLoading.value = false
  }
}

function selectEnvironment() {
  const values = selectedEnvironment.value?.variables || {}
  rows.value = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }))
  if (!rows.value.length) rows.value = [{ key: '', value: '' }]
  rawJson.value = JSON.stringify(values, null, 2)
  secretName.value = ''
  secretValue.value = ''
}

async function saveVariables() {
  if (!canManage.value || !environmentId.value) return
  try {
    const values: Record<string, string> = {}
    if (rawMode.value) {
      const parsed = JSON.parse(rawJson.value)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || Object.values(parsed).some(v => typeof v !== 'string')) throw new Error('Variables must be a JSON object of strings')
      Object.assign(values, parsed)
    } else {
      for (const row of rows.value) {
        const key = row.key.trim()
        if (!key) continue
        if (!/^[A-Za-z_][\w.-]{0,99}$/.test(key)) throw new Error(`Invalid variable name: ${key}`)
        values[key] = String(row.value)
      }
    }
    await $fetch(`/api/v1/workspaces/${current.value?.id}/environments/${environmentId.value}`, {
      method: 'PUT',
      body: { variables: values, ...(secretName.value ? { secrets: { [secretName.value]: secretValue.value } } : {}) },
    })
    secretName.value = ''; secretValue.value = ''
    toast.add({ title: 'Saved', description: 'Environment variables updated', color: 'success' })
    await loadEnvironments()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error?.data?.message || error?.message || 'Unable to save variables', color: 'error' })
  }
}

async function removeSecret(name: string) {
  try {
    await $fetch(`/api/v1/workspaces/${current.value?.id}/environments/${environmentId.value}`, { method: 'PUT', body: { secrets: { [name]: null } } })
    toast.add({ title: 'Removed', description: `Secret ${name} removed`, color: 'success' })
    await loadEnvironments()
  } catch {
    toast.add({ title: 'Error', description: 'Unable to remove secret', color: 'error' })
  }
}

// ---------- API keys ----------
const apiKeys = ref<any[]>([])
const keysLoading = ref(false)
const keyName = ref(''), keyScope = ref<'read' | 'write'>('read'), pinEnvironment = ref(true), keyExpiry = ref('')
const newKeyValue = ref('')

async function loadKeys() {
  if (!canManage.value) return
  keysLoading.value = true
  try {
    const response = await $fetch<any>('/api/v1/api-keys')
    apiKeys.value = response?.data || response || []
  } catch {
    toast.add({ title: 'Error', description: 'Unable to load API keys', color: 'error' })
  } finally {
    keysLoading.value = false
  }
}

async function generateKey() {
  if (!keyName.value) { toast.add({ title: 'Error', description: 'Please enter a name', color: 'error' }); return }
  try {
    const result = await $fetch<any>('/api/v1/api-keys', {
      method: 'POST',
      body: {
        name: keyName.value,
        scope: keyScope.value,
        ...(pinEnvironment.value ? { environmentId: environment.value?.id } : {}),
        ...(keyExpiry.value ? { expires: new Date(keyExpiry.value).toISOString() } : {}),
      },
    })
    newKeyValue.value = result.key
    keyName.value = ''
    toast.add({ title: 'Generated', description: 'Copy the key now; it is shown once.', color: 'success' })
    await loadKeys()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error?.data?.message || 'Unable to generate key', color: 'error' })
  }
}

async function toggleKey(key: any) {
  try {
    await $fetch(`/api/v1/api-keys/${key.id}`, { method: 'PUT', body: { active: !key.active } })
    await loadKeys()
  } catch {
    toast.add({ title: 'Error', description: 'Unable to update key', color: 'error' })
  }
}

async function deleteKey(id: number) {
  if (!confirm('Delete this API key?')) return
  try {
    await $fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' })
    await loadKeys()
  } catch {
    toast.add({ title: 'Error', description: 'Unable to delete key', color: 'error' })
  }
}

// ---------- Global key ----------
const globalConfigured = ref(false)
const globalPrefix = ref<string | null>(null)
const globalValue = ref('')

async function loadGlobalKey() {
  try {
    const info = await $fetch<any>('/api/settings/global-api-key')
    globalConfigured.value = !!info?.configured
    globalPrefix.value = info?.prefix || null
  } catch { /* admin only */ }
}
async function rotateGlobalKey() {
  try {
    const result = await $fetch<any>('/api/settings/global-api-key', { method: 'PUT', body: { action: 'generate' } })
    globalValue.value = result.key
    globalConfigured.value = true
    globalPrefix.value = result.prefix
    toast.add({ title: 'Generated', description: 'Global key generated; copy it now.', color: 'success' })
  } catch {
    toast.add({ title: 'Error', description: 'Unable to generate global key', color: 'error' })
  }
}
async function revokeGlobalKey() {
  if (!confirm('Revoke the global API key? All integrations using it will stop working.')) return
  try {
    await $fetch('/api/settings/global-api-key', { method: 'PUT', body: { action: 'revoke' } })
    globalValue.value = ''; globalConfigured.value = false; globalPrefix.value = null
    toast.add({ title: 'Revoked', color: 'success' })
  } catch {
    toast.add({ title: 'Error', description: 'Unable to revoke global key', color: 'error' })
  }
}
function copy(text: string) {
  navigator.clipboard?.writeText(text)
  toast.add({ title: 'Copied', color: 'success' })
}

onMounted(async () => {
  await load()
  await Promise.all([loadEnvironments(), loadKeys(), loadGlobalKey()])
})
watch(() => current.value?.id, () => { void loadEnvironments(); void loadKeys() })
watch(tab, value => { if (value === 'keys') void loadKeys() })
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="card card-body">
      <h1 class="text-xl font-semibold">Variables & Keys</h1>
      <p class="text-sm text-secondary mt-1">Manage environment variables, secrets and API keys for {{ current?.name || 'this workspace' }} in one place.</p>
      <div class="flex gap-2 mt-4">
        <button class="btn btn-secondary" :class="tab === 'variables' ? 'ring-2 ring-primary' : ''" @click="tab = 'variables'">Environment variables</button>
        <button class="btn btn-secondary" :class="tab === 'keys' ? 'ring-2 ring-primary' : ''" @click="tab = 'keys'">API keys</button>
      </div>
    </div>

    <div v-if="tab === 'variables'" class="card card-body space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">Environment variables</h2>
          <p class="text-xs text-secondary mt-1">Use <code v-pre>{{name}}</code> in URLs, headers and bodies. Saved as a JSON object.</p>
        </div>
        <select v-model.number="environmentId" class="field min-w-40" aria-label="Environment" @change="selectEnvironment">
          <option v-for="item in environments" :key="item.id" :value="item.id">{{ item.name }}</option>
        </select>
      </div>

      <template v-if="canManage">
        <div class="flex justify-end">
          <button type="button" class="text-xs text-primary hover:underline" @click="rawMode = !rawMode">{{ rawMode ? 'Use key/value editor' : 'Edit JSON directly' }}</button>
        </div>
        <div v-if="!rawMode" class="space-y-2">
          <div v-for="(row, index) in rows" :key="index" class="flex flex-wrap gap-2">
            <input v-model="row.key" class="field flex-1 min-w-40" placeholder="VARIABLE_NAME" :aria-label="`Variable name ${index + 1}`">
            <input v-model="row.value" class="field flex-[2] min-w-48" placeholder="value" :aria-label="`Variable value ${index + 1}`">
            <UButton type="button" color="neutral" variant="ghost" size="sm" @click="rows.splice(index, 1)">Remove</UButton>
          </div>
          <UButton type="button" color="neutral" variant="soft" size="sm" @click="rows.push({ key: '', value: '' })">+ Add variable</UButton>
        </div>
        <textarea v-else v-model="rawJson" class="field min-h-32 w-full font-mono" aria-label="Variables JSON" spellcheck="false" />

        <div class="border-t border-current/10 pt-4">
          <h3 class="font-medium text-sm">Secrets</h3>
          <div class="flex flex-wrap gap-3 mt-2">
            <input v-model="secretName" class="field flex-1 min-w-40" placeholder="Secret name" aria-label="Secret name">
            <input v-model="secretValue" type="password" autocomplete="new-password" class="field flex-1 min-w-40" placeholder="Secret value" aria-label="Secret value">
          </div>
          <div v-if="selectedEnvironment?.secretNames.length" class="flex flex-wrap gap-2 mt-3">
            <UButton v-for="name in selectedEnvironment.secretNames" :key="name" type="button" color="neutral" variant="soft" size="sm" @click="removeSecret(name)">Remove {{ name }}</UButton>
          </div>
        </div>
        <UButton :loading="variablesLoading" @click="saveVariables">Save variables</UButton>
      </template>
      <p v-else class="text-sm text-secondary">Only workspace owners can manage variables and secrets.</p>
    </div>

    <div v-else class="space-y-6">
      <div class="card card-body">
        <h2 class="font-semibold">Workspace API keys</h2>
        <p class="text-xs text-secondary mt-1">Scoped keys can be read-only or read/write, and can be pinned to an environment.</p>
        <div class="flex flex-wrap gap-3 mt-4">
          <input v-model="keyName" class="field flex-1 min-w-40" placeholder="Key name" aria-label="Key name">
          <select v-model="keyScope" class="field" aria-label="Key scope"><option value="read">Read</option><option value="write">Read / write</option></select>
          <label class="flex items-center gap-2 text-sm"><input v-model="pinEnvironment" type="checkbox"> Pin to environment</label>
          <input v-model="keyExpiry" type="datetime-local" class="field" aria-label="Expiry">
          <UButton @click="generateKey">Generate</UButton>
        </div>
        <div v-if="newKeyValue" class="mt-4 p-3 rounded bg-tertiary break-all text-sm">
          <code>{{ newKeyValue }}</code>
          <UButton class="ml-2" size="xs" @click="copy(newKeyValue)">Copy</UButton>
        </div>
        <div v-if="keysLoading" class="text-sm text-secondary mt-4">Loading…</div>
        <div v-else class="mt-4 divide-y divide-current/10">
          <div v-for="key in apiKeys" :key="key.id" class="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <span class="font-medium">{{ key.name }}</span>
              <span class="text-xs ml-2" :class="key.active ? 'text-emerald-500' : 'text-secondary'">{{ key.active ? 'Active' : 'Disabled' }}</span>
              <span class="text-xs text-secondary ml-2">{{ key.scope }} · {{ key.prefix }}…</span>
            </div>
            <div class="flex gap-2">
              <UButton size="xs" color="neutral" variant="soft" @click="toggleKey(key)">{{ key.active ? 'Disable' : 'Enable' }}</UButton>
              <UButton size="xs" color="error" variant="soft" @click="deleteKey(key.id)">Delete</UButton>
            </div>
          </div>
          <p v-if="!apiKeys.length" class="py-4 text-sm text-secondary">No API keys generated yet.</p>
        </div>
      </div>

      <div class="card card-body">
        <h2 class="font-semibold">Global API key</h2>
        <p class="text-xs text-secondary mt-1">A platform-wide <code>gk_...</code> key for integrations. Only its SHA-256 hash is stored.</p>
        <div v-if="globalValue" class="mt-4 p-3 rounded bg-tertiary break-all text-sm">
          <code>{{ globalValue }}</code>
          <UButton class="ml-2" size="xs" @click="copy(globalValue)">Copy</UButton>
        </div>
        <p v-else-if="globalConfigured" class="text-sm text-secondary mt-4">Configured ({{ globalPrefix }}…). Generate a new key to rotate it.</p>
        <p v-else class="text-sm text-secondary mt-4">No global API key configured.</p>
        <div class="flex gap-2 mt-4">
          <UButton @click="rotateGlobalKey">{{ globalConfigured ? 'Rotate key' : 'Generate key' }}</UButton>
          <UButton v-if="globalConfigured" color="error" variant="soft" @click="revokeGlobalKey">Revoke</UButton>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.field { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: .5rem; background: transparent; padding: .6rem .8rem; }
</style>
