<script setup lang="ts">
// Settings > Variables: values monitors use as {{name}}, global or per
// workspace (a workspace value overrides the global one for its monitors).
import { workspaceErrorMessage } from '~/composables/useWorkspaces'
import { parseDotEnv } from '~/utils/bruno'

interface Variable {
  id: number
  name: string
  value: string
  secret: boolean
  hasValue: boolean
  workspaceId: number | null
}

const { t } = useI18n()
const toast = useToast()
const { workspaces, loaded } = useWorkspaces()

const variables = ref<Variable[]>([])
const monitors = ref<Record<string, any>[]>([])
const loading = ref(true)
const busy = ref<number | 'new' | null>(null)

/** null = global, number = that workspace */
const scope = ref<number | null>(null)

async function load() {
  try {
    const [vars, mons] = await Promise.all([
      $fetch<{ data: Variable[] }>('/api/v1/variables'),
      $fetch<{ data: Record<string, any>[] }>('/api/v1/monitors?heartbeats=0'),
    ])
    variables.value = vars.data
    monitors.value = mons.data
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to load')), color: 'error' })
  } finally {
    loading.value = false
  }
}
onMounted(load)

const scopeName = computed(() =>
  scope.value == null ? t('Global') : workspaces.value.find(w => w.id === scope.value)?.name ?? '')

const own = computed(() => variables.value.filter(v => v.workspaceId === scope.value))
/** Global variables that apply in this workspace because it does not override them */
const inherited = computed(() => scope.value == null
  ? []
  : variables.value.filter(v => v.workspaceId == null && !own.value.some(o => o.name === v.name)))
const overridden = computed(() => new Set(scope.value == null
  ? []
  : own.value.filter(o => variables.value.some(v => v.workspaceId == null && v.name === o.name)).map(o => o.name)))

// How many monitors refer to each name (any field, e.g. URL or headers)
// Monitors that refer to each name (any field), each monitor once
const users = computed(() => {
  const byName = new Map<string, { id: number; name: string }[]>()
  for (const m of monitors.value) {
    // In a workspace only its own monitors count; globally every monitor does
    if (scope.value != null && m.workspaceId !== scope.value) continue
    const text = JSON.stringify([m.url, m.hostname, m.headers, m.body, m.keyword, m.basicAuthUser, m.basicAuthPass, m.expectedValue, m.jsonPath, m.databaseConnectionString, m.grpcUrl])
    const names = new Set([...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map(match => match[1]))
    for (const name of names) {
      const list = byName.get(name)
      if (list) list.push({ id: m.id, name: m.name })
      else byName.set(name, [{ id: m.id, name: m.name }])
    }
  }
  return byName
})
const usage = computed(() => new Map([...users.value].map(([name, list]) => [name, list.length])))

/** Name whose monitors are listed under its row */
const expanded = ref<string | null>(null)

// ---------- Edit ----------
const drafts = reactive<Record<number, string>>({})

async function save(variable: Variable, patch: Partial<Pick<Variable, 'value' | 'secret'>>) {
  busy.value = variable.id
  try {
    const res = await $fetch<{ data: Variable }>(`/api/v1/variables/${variable.id}`, { method: 'PUT', body: patch })
    variables.value = variables.value.map(v => (v.id === variable.id ? res.data : v))
    delete drafts[variable.id]
    toast.add({ title: t('Variable saved'), color: 'success' })
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to save')), color: 'error' })
  } finally {
    busy.value = null
  }
}

// Un-marking a secret clears its value on the server (it is never revealed)
function toggleSecret(variable: Variable) {
  if (variable.secret && variable.hasValue && !confirm(t('unsecretClearsValue', [variable.name]))) return
  save(variable, { secret: !variable.secret })
}

function commitValue(variable: Variable) {
  const value = drafts[variable.id]
  if (value === undefined) return
  // An empty input on a secret means "keep it"
  if (variable.secret && value === '') {
    delete drafts[variable.id]
    return
  }
  if (!variable.secret && value === variable.value) {
    delete drafts[variable.id]
    return
  }
  save(variable, { value })
}

const pendingDelete = ref<Variable | null>(null)
const confirmOpen = computed({
  get: () => pendingDelete.value !== null,
  set: (v: boolean) => { if (!v) pendingDelete.value = null },
})

async function confirmDelete() {
  const variable = pendingDelete.value
  if (!variable) return
  busy.value = variable.id
  try {
    await $fetch(`/api/v1/variables/${variable.id}`, { method: 'DELETE' })
    variables.value = variables.value.filter(v => v.id !== variable.id)
    pendingDelete.value = null
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to delete')), color: 'error' })
  } finally {
    busy.value = null
  }
}

// ---------- .env import / export ----------
const envOpen = ref(false)
const envText = ref('')
const envSecret = ref(false)
const envBusy = ref(false)

const envParsed = computed(() => Object.entries(parseDotEnv(envText.value)))
const envInvalid = computed(() => envParsed.value.filter(([name]) => !/^[A-Za-z_][\w.-]{0,99}$/.test(name)).map(([n]) => n))

async function importEnv() {
  const valid = envParsed.value.filter(([name]) => !envInvalid.value.includes(name))
  if (!valid.length) return
  envBusy.value = true
  try {
    const res = await $fetch<{ data: { created: number; updated: number } }>('/api/v1/variables/bulk', {
      method: 'POST',
      body: { workspaceId: scope.value, variables: valid.map(([name, value]) => ({ name, value, secret: envSecret.value })) },
    })
    toast.add({ title: t('envImported', [res.data.created, res.data.updated]), color: 'success' })
    envOpen.value = false
    envText.value = ''
    await load()
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to save')), color: 'error' })
  } finally {
    envBusy.value = false
  }
}

/** Download the variables of the shown scope as .env (secret values left empty) */
function exportEnv() {
  // Double-quoted with JSON escapes, which parseDotEnv reads back exactly;
  // a secret is written as an empty value (re-importing it keeps the stored one)
  const quote = (v: string) => (/[\s#"'\\]/.test(v) || v === '' ? JSON.stringify(v) : v)
  const lines = own.value.flatMap(v => v.secret ? [`# ${v.name} is secret: enter its value`, `${v.name}=`] : [`${v.name}=${quote(v.value)}`])
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${scope.value == null ? 'global' : scopeName.value.replace(/[^\w.-]+/g, '-').toLowerCase()}.env`
  link.click()
  URL.revokeObjectURL(link.href)
}

// ---------- Add ----------
const form = reactive({ name: '', value: '', secret: false })
const nameError = ref('')

async function add() {
  nameError.value = ''
  if (!/^[A-Za-z_][\w.-]{0,99}$/.test(form.name.trim())) {
    nameError.value = t('variableNameRule')
    return
  }
  busy.value = 'new'
  try {
    const res = await $fetch<{ data: Variable }>('/api/v1/variables', {
      method: 'POST',
      body: { name: form.name.trim(), value: form.value, secret: form.secret, workspaceId: scope.value },
    })
    variables.value = [...variables.value, res.data]
    form.name = ''
    form.value = ''
    form.secret = false
  } catch (e) {
    nameError.value = workspaceErrorMessage(e, t('Failed to save'))
  } finally {
    busy.value = null
  }
}

/** Start a workspace override from an inherited global variable */
function override(global: Variable) {
  form.name = global.name
  form.value = global.secret ? '' : global.value
  form.secret = global.secret
  nextTick(() => document.getElementById('variable-new-value')?.focus())
}
</script>

<template>
  <div>
    <p class="mb-4 max-w-2xl text-sm text-muted">{{ t('variablesIntro') }}</p>

    <!-- Scope -->
    <div v-if="loaded" class="mb-4 flex flex-wrap items-center gap-2" role="group" :aria-label="t('Scope')">
      <button type="button" class="scope-chip" :class="{ 'scope-chip-active': scope === null }" :aria-pressed="scope === null" @click="scope = null">
        <UIcon name="i-heroicons-globe-alt" class="size-4" />
        {{ t('Global') }}
        <span class="scope-count">{{ variables.filter(v => v.workspaceId == null).length }}</span>
      </button>
      <button
        v-for="w in workspaces"
        :key="w.id"
        type="button"
        class="scope-chip"
        :class="{ 'scope-chip-active': scope === w.id }"
        :aria-pressed="scope === w.id"
        @click="scope = w.id"
      >
        <span class="size-2.5 rounded-full" :style="{ backgroundColor: w.color }" aria-hidden="true" />
        {{ w.name }}
        <span class="scope-count">{{ variables.filter(v => v.workspaceId === w.id).length }}</span>
      </button>
    </div>

    <div v-if="loading" class="flex justify-center py-12"><div class="spinner size-8" /></div>

    <div v-else class="overflow-hidden rounded-lg border border-default">
      <table class="w-full text-sm">
        <!-- Phones: each variable is a block (name on its own line), wider screens: a table -->
        <thead class="hidden bg-elevated text-left text-xs text-muted sm:table-header-group">
          <tr>
            <th class="px-3 py-2 font-medium">{{ t('Name') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('Value') }}</th>
            <th class="hidden px-3 py-2 font-medium sm:table-cell">{{ t('Used by') }}</th>
            <th class="w-24 px-3 py-2 text-right font-medium"><span class="sr-only">{{ t('Actions') }}</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-(--uk-border)">
          <tr v-for="v in own" :key="v.id" class="flex flex-wrap items-center sm:table-row">
            <td class="basis-full px-3 pt-2 align-middle sm:basis-auto sm:py-2">
              <code class="break-words text-highlighted">{{ v.name }}</code>
              <div class="mt-0.5 flex flex-wrap gap-1">
                <UBadge v-if="v.secret" size="sm" color="neutral" variant="subtle" icon="i-heroicons-lock-closed" class="whitespace-nowrap">{{ t('Secret') }}</UBadge>
                <UBadge v-if="overridden.has(v.name)" size="sm" color="info" variant="subtle">{{ t('Overrides global') }}</UBadge>
              </div>
            </td>
            <td class="min-w-0 flex-1 px-3 py-2">
              <input
                :type="v.secret ? 'password' : 'text'"
                class="input-field py-1 font-mono text-xs"
                :value="drafts[v.id] ?? (v.secret ? '' : v.value)"
                :placeholder="v.secret ? (v.hasValue ? t('secretSetPlaceholder') : t('brunoVarEnterValue')) : ''"
                :aria-label="`${t('Value')}: ${v.name}`"
                :disabled="busy === v.id"
                autocomplete="off"
                @input="drafts[v.id] = ($event.target as HTMLInputElement).value"
                @keydown.enter.prevent="commitValue(v)"
                @blur="commitValue(v)"
              >
            </td>
            <td class="hidden px-3 py-2 text-muted sm:table-cell">
              <button
                v-if="usage.get(v.name)"
                type="button"
                class="link"
                :aria-expanded="expanded === v.name"
                @click="expanded = expanded === v.name ? null : v.name"
              >
                {{ t('monitorCountShort', [usage.get(v.name)]) }}
              </button>
              <span v-else>{{ t('monitorCountShort', [0]) }}</span>
              <ul v-if="expanded === v.name" class="mt-1 space-y-0.5 text-xs">
                <li v-for="m in users.get(v.name)" :key="m.id">
                  <NuxtLink :to="`/monitors/${m.id}`" class="link">{{ m.name }}</NuxtLink>
                </li>
              </ul>
            </td>
            <td class="px-3 py-2">
              <div class="flex justify-end gap-1">
                <UButton
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  :icon="v.secret ? 'i-heroicons-lock-open' : 'i-heroicons-lock-closed'"
                  :aria-label="`${v.secret ? t('Mark as not secret') : t('Mark as secret')}: ${v.name}`"
                  :title="v.secret ? t('Mark as not secret') : t('Mark as secret')"
                  :disabled="busy === v.id"
                  @click="toggleSecret(v)"
                />
                <UButton
                  variant="ghost"
                  color="error"
                  size="xs"
                  icon="i-heroicons-trash"
                  :aria-label="`${t('Delete')}: ${v.name}`"
                  :title="t('Delete')"
                  :disabled="busy === v.id"
                  @click="pendingDelete = v"
                />
              </div>
            </td>
          </tr>

          <!-- Global values in effect in this workspace -->
          <tr v-for="g in inherited" :key="`g-${g.id}`" class="flex flex-wrap items-center bg-muted/40 text-muted sm:table-row">
            <td class="basis-full px-3 pt-2 sm:basis-auto sm:py-2">
              <code class="break-words">{{ g.name }}</code>
              <div class="mt-0.5"><UBadge size="sm" color="neutral" variant="outline">{{ t('Inherited from global') }}</UBadge></div>
            </td>
            <td class="min-w-0 flex-1 px-3 py-2 font-mono text-xs">{{ g.secret ? '••••••' : g.value }}</td>
            <td class="hidden px-3 py-2 sm:table-cell">{{ t('monitorCountShort', [usage.get(g.name) ?? 0]) }}</td>
            <td class="px-3 py-2 text-right">
              <UButton variant="ghost" color="neutral" size="xs" icon="i-heroicons-pencil-square" @click="override(g)">
                {{ t('Override') }}
              </UButton>
            </td>
          </tr>

          <tr v-if="!own.length && !inherited.length">
            <td colspan="4" class="px-3 py-8 text-center text-muted">{{ t('noVariablesYet', [scopeName]) }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Add -->
      <form class="flex flex-wrap items-start gap-2 border-t border-default bg-elevated px-3 py-3" @submit.prevent="add">
        <div class="min-w-40 flex-1">
          <input
            v-model="form.name"
            type="text"
            class="input-field py-1 font-mono text-xs"
            :placeholder="t('variableNamePlaceholder')"
            :aria-label="t('Name')"
            autocomplete="off"
          >
          <p v-if="nameError" class="mt-1 text-xs text-down-fg">{{ nameError }}</p>
        </div>
        <input
          id="variable-new-value"
          v-model="form.value"
          :type="form.secret ? 'password' : 'text'"
          class="input-field min-w-40 flex-[2] py-1 font-mono text-xs"
          :placeholder="t('Value')"
          :aria-label="t('Value')"
          autocomplete="off"
        >
        <label class="flex items-center gap-1.5 py-1 text-sm">
          <input v-model="form.secret" type="checkbox" class="checkbox">
          {{ t('Secret') }}
        </label>
        <UButton type="submit" size="sm" icon="i-heroicons-plus" :loading="busy === 'new'">
          {{ t('addVariableTo', [scopeName]) }}
        </UButton>
      </form>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <UButton size="sm" variant="outline" color="neutral" icon="i-heroicons-document-arrow-down" @click="envOpen = true">
        {{ t('Import .env') }}
      </UButton>
      <UButton size="sm" variant="ghost" color="neutral" icon="i-heroicons-arrow-down-tray" :disabled="!own.length" @click="exportEnv">
        {{ t('Download .env') }}
      </UButton>
    </div>

    <p class="mt-3 text-xs text-muted">{{ t('variablesUsageHint') }}</p>

    <UModal v-model:open="envOpen" :title="`${t('Import .env')} → ${scopeName}`" :description="t('envImportHint')" :ui="{ footer: 'justify-end' }">
      <template #default><span class="hidden" /></template>
      <template #body>
        <textarea
          v-model="envText"
          rows="8"
          class="input-field font-mono text-xs"
          placeholder="BASE_URL=https://api.example.com&#10;API_TOKEN=..."
          :aria-label="t('Import .env')"
        />
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <label class="flex items-center gap-1.5 text-sm">
            <input v-model="envSecret" type="checkbox" class="checkbox">
            {{ t('envImportAsSecret') }}
          </label>
          <span class="text-muted">{{ t('envFound', [envParsed.length - envInvalid.length]) }}</span>
        </div>
        <p v-if="envInvalid.length" class="mt-1 text-xs text-pending-fg">{{ t('envSkippedNames', [envInvalid.join(', ')]) }}</p>
      </template>
      <template #footer>
        <UButton variant="ghost" color="neutral" :disabled="envBusy" @click="envOpen = false">{{ t('Cancel') }}</UButton>
        <UButton :loading="envBusy" :disabled="envParsed.length === envInvalid.length" @click="importEnv">{{ t('Import') }}</UButton>
      </template>
    </UModal>

    <CommonConfirmDialog
      v-model:open="confirmOpen"
      :title="pendingDelete ? `${t('Delete')}: ${pendingDelete.name}` : ''"
      :message="t('deleteVariableMsg', [usage.get(pendingDelete?.name ?? '') ?? 0])"
      type="danger"
      :confirm-text="t('Delete')"
      :cancel-text="t('Cancel')"
      :loading="busy !== null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.scope-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid var(--uk-border);
  font-size: 0.875rem;
  color: var(--uk-text-muted);
}

.scope-chip:hover {
  color: var(--uk-text);
}

.scope-chip-active {
  color: var(--uk-text);
  border-color: var(--uk-primary);
  background-color: color-mix(in srgb, var(--uk-primary) 14%, transparent);
}

.scope-count {
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
