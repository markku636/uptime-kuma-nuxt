<script setup lang="ts">
import type { BrunoFile } from '../../shared/types/bruno'
import { readBrunoZip } from '../../composables/useBruno'

definePageMeta({ middleware: ['auth'] })
const router = useRouter()
const toast = useToast()
const source = ref<'files' | 'zip' | 'paste'>('files')
const files = ref<BrunoFile[]>([])
const pasted = ref('')
const zipName = ref('')
const collectionId = ref('collection')
const name = ref('')
const variablesText = ref('')
const busy = ref(false)
const error = ref('')
const preview = ref<any>(null)

function setSource(value: string) { source.value = value as 'files' | 'zip' | 'paste'; preview.value = null }

const fileInput = ref<HTMLInputElement | null>(null)
const zipInput = ref<HTMLInputElement | null>(null)

const manifestFiles = computed<BrunoFile[]>(() => {
  if (source.value === 'paste') {
    return pasted.value.trim() ? [{ path: 'request.bru', content: pasted.value.trimEnd() + '\n' }] : []
  }
  return files.value
})

function parseVariables(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of variablesText.value.split('\n')) {
    const match = /^\s*([A-Za-z_][\w.-]*)\s*:\s*(.*?)\s*$/.exec(line)
    if (match && match[1]) result[match[1]] = match[2] || ''
  }
  return result
}

function payload(digest?: string) {
  return {
    collectionId: collectionId.value, name: name.value, files: manifestFiles.value,
    variables: parseVariables(), ...(digest ? { digest } : {}),
  }
}

async function onFiles(event: Event) {
  const input = event.target as HTMLInputElement
  files.value = []
  for (const file of Array.from(input.files || [])) {
    files.value.push({ path: file.name, content: await file.text() })
  }
  preview.value = null
}

async function onZip(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  zipName.value = file.name
  files.value = (await readBrunoZip(file)).files
  preview.value = null
}

watch([source, collectionId, name, variablesText, manifestFiles], () => { preview.value = null }, { deep: true })

async function doPreview() {
  busy.value = true
  error.value = ''
  try {
    if (!manifestFiles.value.length) throw new Error('Add at least one .bru file')
    preview.value = await $fetch('/api/v1/bruno/tests/preview', { method: 'POST', body: payload() })
  } catch (e: any) { error.value = e.data?.message || e.message || 'Preview failed' }
  finally { busy.value = false }
}

async function create() {
  if (!preview.value?.digest) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<any>('/api/v1/bruno/tests', { method: 'POST', body: payload(preview.value.digest) })
    toast.add({ title: 'Bruno test created', description: `${result.data.steps} steps ready`, color: 'success' })
    router.push(`/bruno-tests/${result.data.id}`)
  } catch (e: any) { error.value = e.data?.message || 'Create failed' }
  finally { busy.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">New Bruno test</h1>
      <p class="text-sm text-secondary">Upload or paste a collection. Requests run in file order; <code>vars:post-response</code> values can feed later steps.</p>
    </div>
    <section class="card p-5 space-y-4">
      <div class="grid sm:grid-cols-2 gap-4">
        <label class="block text-sm">Name
          <input v-model="name" class="input-field mt-1" placeholder="Checkout flow" />
        </label>
        <label class="block text-sm">Collection ID
          <input v-model="collectionId" class="input-field mt-1" />
        </label>
      </div>
      <div class="flex flex-wrap gap-3">
        <button v-for="item in [{v:'files',l:'.bru files'},{v:'zip',l:'ZIP collection'},{v:'paste',l:'Paste request'}]" :key="item.v"
          class="btn btn-sm" :class="source === item.v ? 'btn-primary' : 'btn-secondary'" @click="setSource(item.v)">{{ item.l }}</button>
      </div>
      <div v-if="source === 'files'">
        <input ref="fileInput" type="file" multiple accept=".bru,.json" class="block text-sm" @change="onFiles" />
        <p class="text-xs text-secondary mt-1">{{ manifestFiles.length }} file(s) loaded. Alphabetical order is the run order.</p>
      </div>
      <div v-else-if="source === 'zip'">
        <input ref="zipInput" type="file" accept=".zip" class="block text-sm" @change="onZip" />
        <p class="text-xs text-secondary mt-1">{{ zipName || 'No ZIP selected' }} · {{ manifestFiles.length }} file(s)</p>
      </div>
      <div v-else>
        <textarea v-model="pasted" rows="12" class="input-field w-full font-mono text-xs" placeholder="Paste one .bru request"></textarea>
      </div>
      <label class="block text-sm">Extra variables (one <code>name: value</code> per line)
        <textarea v-model="variablesText" rows="3" class="input-field w-full mt-1" placeholder="baseUrl: https://api.example.com"></textarea>
      </label>
      <div class="flex gap-3">
        <button class="btn btn-secondary" :disabled="busy || !manifestFiles.length" @click="doPreview">{{ busy ? 'Working…' : 'Preview' }}</button>
        <button class="btn btn-primary" :disabled="busy || !preview?.ok || !name.trim()" @click="create">Create test</button>
      </div>
      <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    </section>
    <section v-if="preview" class="card p-5">
      <h2 class="font-semibold mb-3">Preview</h2>
      <p v-if="preview.issues?.length" class="text-red-400 text-sm">{{ preview.issues.map((i: any) => `${i.file || 'manifest'}: ${i.code}`).join(' · ') }}</p>
      <table v-else class="table">
        <thead><tr><th>#</th><th>Name</th><th>Method</th><th>Path</th><th>Extract</th></tr></thead>
        <tbody>
          <tr v-for="(step, index) in preview.steps" :key="step.path">
            <td>{{ Number(index) + 1 }}</td><td>{{ step.name }}</td><td>{{ step.method }}</td>
            <td class="font-mono text-xs">{{ step.path }}</td>
            <td class="text-xs">{{ step.extract.map((rule: any) => rule.name).join(', ') || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
