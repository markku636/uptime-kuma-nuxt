<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })
const route = useRoute()
const toast = useToast()
const id = computed(() => Number(route.params.id))
const suite = ref<any>(null)
const runs = ref<any[]>([])
const report = ref<any>(null)
const busy = ref(false)
const error = ref('')

async function load() {
  error.value = ''
  try {
    const [detail, history] = await Promise.all([
      $fetch<any>(`/api/v1/bruno/tests/${id.value}`),
      $fetch<any>(`/api/v1/bruno/tests/${id.value}/runs`),
    ])
    suite.value = detail.data
    runs.value = history.data || []
    if (runs.value.length) await openRun(runs.value[0]!.id)
  } catch (e: any) { error.value = e.data?.message || 'Unable to load test suite' }
}

async function openRun(runId: string) {
  try {
    const result = await $fetch<any>(`/api/v1/bruno/tests/${id.value}/runs/${runId}`)
    report.value = result.data
  } catch (e: any) { error.value = e.data?.message || 'Unable to load report' }
}

async function run() {
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<any>(`/api/v1/bruno/tests/${id.value}/run`, { method: 'POST' })
    toast.add({ title: `Test ${result.data.status}`, color: result.data.status === 'pass' ? 'success' : 'error' })
    await load()
  } catch (e: any) {
    error.value = e.data?.message || 'Run failed'
  } finally { busy.value = false }
}

async function saveSettings() {
  try {
    await $fetch(`/api/v1/bruno/tests/${id.value}`, { method: 'PUT', body: {
      name: suite.value.name, failFast: suite.value.failFast, timeoutSec: suite.value.timeoutSec,
    } })
    toast.add({ title: 'Settings saved', color: 'success' })
  } catch (e: any) { error.value = e.data?.message || 'Save failed' }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <NuxtLink to="/bruno-tests" class="text-xs link">← Bruno Tests</NuxtLink>
        <h1 class="text-2xl font-semibold">{{ suite?.name || 'Bruno test' }}</h1>
        <p v-if="suite" class="text-sm text-secondary">{{ suite.collectionId }} · {{ suite.steps?.length }} steps</p>
      </div>
      <button class="btn btn-primary" :disabled="busy || !suite" @click="run">{{ busy ? 'Running…' : 'Run test' }}</button>
    </div>
    <p v-if="error" role="alert" class="text-red-400">{{ error }}</p>
    <p v-if="!suite">Loading…</p>
    <template v-else>
      <section class="card p-5 space-y-4">
        <h2 class="font-semibold">Settings</h2>
        <div class="grid sm:grid-cols-3 gap-4 items-end">
          <label class="text-sm">Name<input v-model="suite.name" class="input-field mt-1" /></label>
          <label class="flex items-center gap-2 text-sm"><input v-model="suite.failFast" type="checkbox" /> Stop on first failure</label>
          <label class="text-sm">Total timeout (s)<input v-model.number="suite.timeoutSec" type="number" min="30" max="180" class="input-field mt-1" /></label>
        </div>
        <button class="btn btn-secondary btn-sm" @click="saveSettings">Save settings</button>
      </section>

      <section class="card p-5 overflow-x-auto">
        <h2 class="font-semibold mb-3">Steps</h2>
        <table class="table">
          <thead><tr><th>#</th><th>Name</th><th>Method</th><th>Path</th><th>Extract</th></tr></thead>
          <tbody>
            <tr v-for="(step, index) in suite.steps" :key="step.path">
              <td>{{ Number(index) + 1 }}</td><td>{{ step.name }}</td><td>{{ step.method }}</td>
              <td class="font-mono text-xs">{{ step.path }}</td>
              <td class="text-xs">{{ step.extract.map((rule: any) => rule.name).join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 class="font-semibold">Reports</h2>
          <div v-if="report" class="flex gap-2">
            <a class="btn btn-secondary btn-sm" :href="`/api/v1/bruno/tests/${id}/runs/${report.id}/export?format=json`">Download JSON</a>
            <a class="btn btn-secondary btn-sm" :href="`/api/v1/bruno/tests/${id}/runs/${report.id}/export?format=csv`">Download CSV</a>
          </div>
        </div>
        <div v-if="!runs.length" class="text-sm text-secondary">No runs yet. Press “Run test” to generate the first report.</div>
        <div v-else class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <button v-for="run in runs" :key="run.id" class="btn btn-sm"
              :class="report?.id === run.id ? 'btn-primary' : 'btn-secondary'" @click="openRun(run.id)">
              #{{ run.id }} · {{ run.status }} · {{ new Date(run.startedAt).toLocaleString() }}
            </button>
          </div>
          <div v-if="report">
            <p class="text-sm">
              <span class="font-semibold" :class="report.status === 'pass' ? 'text-green-500' : 'text-red-400'">{{ report.status }}</span>
              · {{ report.summary.passed }} passed / {{ report.summary.failed }} failed / {{ report.summary.skipped }} skipped
              · {{ report.summary.durationMs }} ms
            </p>
            <div class="overflow-x-auto mt-3">
              <table class="table">
                <thead><tr><th>#</th><th>Name</th><th>Status</th><th>HTTP</th><th>Elapsed</th><th>Assertions</th><th>Error</th></tr></thead>
                <tbody>
                  <tr v-for="step in report.steps" :key="step.stepIndex">
                    <td>{{ step.stepIndex + 1 }}</td>
                    <td>{{ step.name }} <span class="text-xs text-secondary">{{ step.method }}</span></td>
                    <td>{{ step.status }}</td>
                    <td>{{ step.httpStatus ?? '—' }}</td>
                    <td>{{ step.elapsedMs }} ms</td>
                    <td class="text-xs">
                      <template v-if="step.assertions?.rules?.length">
                        {{ step.assertions.rules.filter((rule: any) => rule.passed).length }} / {{ step.assertions.rules.length }} passed
                      </template>
                      <template v-else>—</template>
                    </td>
                    <td class="text-xs">{{ step.errorCode || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
