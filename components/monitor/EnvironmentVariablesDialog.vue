<template>
  <UModal
    :open="open"
    @update:open="emit('update:open', $event)"
    :title="`Environment variables — ${selectedEnvironment?.name || 'Environment'}`"
    :ui="{ footer: 'justify-end' }"
  >
    <template #default><span class="hidden"></span></template>

    <template #body>
      <div class="space-y-4">
        <div class="rounded-lg border border-current/15 p-3 space-y-1">
          <p class="font-semibold">GLOBAL variables for {{ selectedEnvironment?.name || 'this environment' }}</p>
          <p class="text-xs text-secondary">
            These variables and secrets apply to every monitor and request in this environment, not just this one.
            Use <code>&#123;&#123;NAME&#125;&#125;</code> placeholders to reference them. Saving reschedules every monitor in this environment.
          </p>
          <label class="flex flex-wrap items-center gap-2 text-xs text-secondary" for="env-dialog-environment">
            Environment
            <select id="env-dialog-environment" v-model.number="editingEnvironmentId" class="env-field min-w-40" aria-label="Environment" @change="populate">
              <option v-for="item in environments" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <NuxtLink :to="`/settings/workspaces?environment=${editingEnvironmentId || ''}`" class="inline-block text-xs text-primary hover:underline">Open full editor in Settings → Workspaces</NuxtLink>
        </div>

        <p v-if="readOnly" role="alert" class="text-sm text-amber-500">
          Workspace owner required. <NuxtLink :to="`/settings/workspaces?environment=${editingEnvironmentId || ''}`" class="underline">Open Settings → Workspaces</NuxtLink> to manage variables and secrets.
        </p>
        <p v-if="formError || error" role="alert" class="text-sm text-red-500">{{ formError || error }}</p>
        <p v-if="notice" role="status" class="text-sm text-emerald-500">{{ notice }}</p>

        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium">Variables ({{ variableCount }}/200)</span>
          <div class="flex items-center gap-3">
            <button type="button" class="text-xs text-primary hover:underline disabled:opacity-50" :disabled="readOnly" @click="populate()">Reset changes</button>
            <button type="button" class="text-xs text-primary hover:underline disabled:opacity-50" :disabled="readOnly" @click="toggleRawMode">
              {{ rawMode ? 'Use key/value editor' : 'Edit JSON directly' }}
            </button>
          </div>
        </div>

        <textarea
          v-if="rawMode"
          v-model="rawJson"
          class="env-field min-h-32 w-full font-mono text-sm"
          aria-label="Environment variables JSON"
          spellcheck="false"
          :disabled="readOnly"
        />
        <table v-else class="w-full text-sm">
          <thead>
            <tr><th class="text-left py-1 pr-2">Name</th><th class="text-left py-1 pr-2">Value</th><th class="py-1"></th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in variableRows" :key="index">
              <td class="py-1 pr-2">
                <input v-model="row.key" class="env-field w-full" placeholder="VARIABLE_NAME" :aria-label="`Variable name ${index + 1}`" :disabled="readOnly">
                <p v-if="row.key.trim() && !isValidVariableName(row.key.trim())" class="text-xs text-red-500 mt-1">Invalid variable name</p>
              </td>
              <td class="py-1 pr-2"><input v-model="row.value" class="env-field w-full" placeholder="value" :aria-label="`Variable value ${index + 1}`" :disabled="readOnly"></td>
              <td class="py-1 whitespace-nowrap">
                <UButton size="xs" variant="ghost" color="neutral" :disabled="!row.key.trim()" :aria-label="`Insert variable ${index + 1}`" @click="insertName(row.key)">Insert</UButton>
                <UButton size="xs" variant="ghost" color="neutral" :disabled="!row.key.trim()" :aria-label="`Copy token for variable ${index + 1}`" @click="copyToken(row.key)">Copy token</UButton>
                <UButton size="xs" variant="ghost" color="neutral" :disabled="readOnly" :aria-label="`Remove variable ${index + 1}`" @click="variableRows.splice(index, 1)">Remove</UButton>
              </td>
            </tr>
          </tbody>
        </table>
        <UButton size="sm" variant="soft" color="neutral" :disabled="readOnly || variableCount >= 200" @click="variableRows.push({ key: '', value: '' })">+ Add variable</UButton>

        <div class="border-t border-current/10 pt-3 space-y-2">
          <h4 class="text-sm font-medium">Secrets</h4>
          <p class="text-xs text-secondary">
            Values are encrypted, never returned after saving, and shown as <code>••••••</code>. Leave a new value empty to keep the current secret.
          </p>
          <table class="w-full text-sm">
            <thead>
              <tr><th class="text-left py-1 pr-2">Name</th><th class="text-left py-1 pr-2">Value</th><th class="py-1"></th></tr>
            </thead>
            <tbody>
              <tr v-for="name in existingSecrets" :key="name">
                <td class="py-1 pr-2"><code>{{ name }}</code></td>
                <td class="py-1 pr-2">
                  <span class="text-secondary">••••••</span>
                  <input v-model="secretUpdates[name]" type="password" autocomplete="new-password" class="env-field ml-2 w-40" placeholder="New value" :aria-label="`New value for ${name}`" :disabled="readOnly">
                </td>
                <td class="py-1 whitespace-nowrap">
                  <UButton size="xs" variant="ghost" color="neutral" :aria-label="`Insert secret ${name}`" @click="insertName(name)">Insert</UButton>
                  <UButton size="xs" variant="ghost" color="neutral" :disabled="readOnly" :aria-label="`Delete secret ${name}`" @click="removeSecret(name)">Delete</UButton>
                </td>
              </tr>
              <tr v-for="(row, index) in newSecrets" :key="`new-${index}`">
                <td class="py-1 pr-2"><input v-model="row.name" class="env-field w-full" placeholder="SECRET_NAME" :aria-label="`New secret name ${index + 1}`" :disabled="readOnly"></td>
                <td class="py-1 pr-2"><input v-model="row.value" type="password" autocomplete="new-password" class="env-field w-full" placeholder="Secret value" :aria-label="`New secret value ${index + 1}`" :disabled="readOnly"></td>
                <td class="py-1 whitespace-nowrap">
                  <UButton size="xs" variant="ghost" color="neutral" :aria-label="`Remove new secret ${index + 1}`" :disabled="readOnly" @click="newSecrets.splice(index, 1)">Remove</UButton>
                </td>
              </tr>
            </tbody>
          </table>
          <UButton size="sm" variant="soft" color="neutral" :disabled="readOnly || secretCount >= 200" @click="newSecrets.push({ name: '', value: '' })">+ Add secret</UButton>
        </div>

        <div class="border-t border-current/10 pt-3 space-y-2">
          <label class="text-xs text-secondary" for="env-dialog-preview">Preview placeholders (uses unsaved values above)</label>
          <input id="env-dialog-preview" v-model="previewText" class="env-field w-full" :placeholder="'{{baseUrl}}/health?token={{apiKey}}'" />
          <p v-if="previewResult" class="text-xs" :class="previewResult.missing.length ? 'text-amber-500' : 'text-emerald-500'">
            Resolved: <code class="break-all">{{ previewResult.preview }}</code>
            <span v-if="previewResult.missing.length"> · Unknown: {{ previewResult.missing.join(', ') }}</span>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <UButton variant="ghost" @click="emit('update:open', false)">Close</UButton>
      <UButton color="primary" :loading="saving" :disabled="readOnly" @click="save">Save variables</UButton>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { isValidVariableName, useEnvironmentVariables, validateVariableMap } from '~/composables/useEnvironmentVariables'

const props = defineProps<{ open: boolean; environmentId?: number; disabled?: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  insert: [value: string]
  saved: []
}>()

const { current, environment: currentEnvironment, canManage } = useWorkspace()
const { environments, error, load, selected, saveEnvironment, preview } = useEnvironmentVariables()

const editingEnvironmentId = ref<number | undefined>()
const selectedEnvironment = selected(editingEnvironmentId)
const variableRows = ref<{ key: string; value: string }[]>([])
const rawJson = ref('{}'), rawMode = ref(false)
const secretUpdates = ref<Record<string, string>>(Object.create(null))
const newSecrets = ref<{ name: string; value: string }[]>([])
const previewText = ref(''), formError = ref(''), notice = ref('')
const saving = ref(false)

const readOnly = computed(() => !!props.disabled || !canManage.value)
const existingSecrets = computed(() => selectedEnvironment.value?.secretNames || [])
const secretCount = computed(() => existingSecrets.value.length + newSecrets.value.length)
const variableCount = computed(() => {
  if (!rawMode.value) return variableRows.value.filter(row => row.key.trim()).length
  try { return Object.keys(validateVariableMap(JSON.parse(rawJson.value), { checkNames: false })).length } catch { return 0 }
})
const previewResult = computed(() => {
  const text = previewText.value
  if (!text?.includes('{{')) return null
  const variables: Record<string, string> = {}
  if (rawMode.value) {
    try { Object.assign(variables, validateVariableMap(JSON.parse(rawJson.value), {checkNames: false})) } catch { /* show missing placeholders */ }
  } else {
    for (const row of variableRows.value) if (row.key.trim()) variables[row.key.trim()] = row.value
  }
  return preview(text, { ...(selectedEnvironment.value || { id: 0, workspaceId: 0, name: '', secretNames: [] }), variables })
})

async function copyToken(name: string) {
  const token = `{{${name.trim()}}}`
  try { await navigator.clipboard.writeText(token); notice.value = `Copied ${token}` }
  catch { formError.value = 'Clipboard unavailable; select and copy the name manually.' }
}

function populate() {
  const values = selectedEnvironment.value?.variables || {}
  variableRows.value = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }))
  if (!variableRows.value.length) variableRows.value = [{ key: '', value: '' }]
  rawJson.value = JSON.stringify(values, null, 2)
  rawMode.value = false
  secretUpdates.value = Object.create(null)
  newSecrets.value = []
  formError.value = ''; notice.value = ''
}

let openSequence = 0
watch([() => props.open, () => current.value?.id, () => props.environmentId], async ([open, workspaceId], old) => {
  if (!open || !workspaceId) return
  if (old && old[0] === open && old[1] === workspaceId && old[2] === props.environmentId) return
  const sequence = ++openSequence
  try {
    await load(workspaceId)
    if (sequence !== openSequence || !props.open) return
    const list = environments.value
    const preferred = props.environmentId ?? currentEnvironment.value?.id
    editingEnvironmentId.value = (list.find(item => item.id === preferred) || list.find(item => item.id === editingEnvironmentId.value) || list[0])?.id
    populate()
  } catch { /* error is reported by the composable */ }
}, { immediate: true })

function insertName(name: string) {
  const key = name.trim()
  if (key) emit('insert', `{{${key}}}`)
}

function toggleRawMode() {
  if (readOnly.value) return
  try {
    if (!rawMode.value) {
      const values: Record<string, string> = {}
      for (const row of variableRows.value) {
        const key = row.key.trim()
        if (key) values[key] = String(row.value)
      }
      rawJson.value = JSON.stringify(values, null, 2)
    } else {
      const values = validateVariableMap(JSON.parse(rawJson.value), { checkNames: false })
      variableRows.value = Object.entries(values).map(([key, value]) => ({ key, value }))
      if (!variableRows.value.length) variableRows.value = [{ key: '', value: '' }]
    }
    formError.value = ''
    rawMode.value = !rawMode.value
  } catch (e: any) { formError.value = e?.message || 'Invalid variables' }
}

async function save() {
  const workspaceId = current.value?.id, environmentId = editingEnvironmentId.value
  if (!workspaceId || !environmentId || readOnly.value || saving.value) return
  saving.value = true; formError.value = ''; notice.value = ''
  try {
    let values: Record<string, string>
    if (rawMode.value) {
      values = validateVariableMap(JSON.parse(rawJson.value), { checkNames: false })
    } else {
      const rows: Record<string, string> = {}
      for (const row of variableRows.value) {
        const key = row.key.trim()
        if (!key) continue
        if (!isValidVariableName(key)) throw new Error(`Invalid variable name: ${key}`)
        rows[key] = String(row.value)
      }
      values = validateVariableMap(rows, { checkNames: false })
    }
    const secrets: Record<string, string | null> = Object.create(null)
    for (const [name, value] of Object.entries(secretUpdates.value)) {
      if (value !== '') secrets[name] = value
    }
    for (const row of newSecrets.value) {
      const name = row.name.trim()
      if (!name && !row.value) continue
      if (!isValidVariableName(name)) throw new Error(`Invalid variable name: ${name}`)
      if (!row.value) throw new Error(`Enter a value for secret ${name}`)
      if (Object.prototype.hasOwnProperty.call(values, name)) throw new Error(`Variable and secret names must be distinct: ${name}`)
      secrets[name] = row.value
    }
    await saveEnvironment(workspaceId, environmentId, {
      variables: values,
      ...(Object.keys(secrets).length ? { secrets } : {}),
    })
    secretUpdates.value = Object.create(null)
    newSecrets.value = []
    notice.value = 'Saved. Monitors in this environment are rescheduled and will use the new values on their next check.'
    emit('saved')
  } catch (e: any) {
    formError.value = e?.data?.message || e?.message || 'Unable to save environment variables'
  } finally { saving.value = false }
}

async function removeSecret(name: string) {
  const workspaceId = current.value?.id, environmentId = editingEnvironmentId.value
  if (readOnly.value || !workspaceId || !environmentId || saving.value) return
  saving.value = true; formError.value = ''; notice.value = ''
  try {
    await saveEnvironment(workspaceId, environmentId, { secrets: { [name]: null } })
    delete secretUpdates.value[name]
    notice.value = 'Saved. Monitors in this environment are rescheduled and will use the new values on their next check.'
    emit('saved')
  } catch (e: any) {
    formError.value = e?.data?.message || e?.message || 'Unable to delete secret'
  } finally { saving.value = false }
}
</script>

<style scoped>
.env-field { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: .5rem; background: transparent; padding: .45rem .6rem; }
</style>
