<script setup lang="ts">
import type { RuntimeHintData } from '~/composables/useRuntimeHint'

type Kind = 'api' | 'worker' | 'slots' | 'overview'

const props = withDefaults(defineProps<{ kind?: Kind }>(), { kind: 'overview' })

const { load } = useRuntimeHint()
const hintsEnabled = useState<boolean>('show-runtime-hints', () => true)
const hintsLoaded = useState<boolean>('show-runtime-hints-loaded', () => false)
if (import.meta.client && !hintsLoaded.value) {
  hintsLoaded.value = true
  $fetch<any>('/api/settings/general').then(settings => { hintsEnabled.value = settings?.showRuntimeHints !== false }).catch(() => {})
}
const open = ref(false)
const data = ref<RuntimeHintData | null>(null)

const labelKey = computed(() => {
  if (props.kind === 'api') return 'API — serves the web UI, REST API and live updates. It never runs checks.'
  if (props.kind === 'worker') return 'Worker — pulls due checks from the shared PostgreSQL queue and runs them.'
  if (props.kind === 'slots') return 'Slots in use — checks running now divided by the total check slots across all workers (for example 0/64). One check occupies one slot until it finishes.'
  return 'About API, workers and check slots'
})

async function onOpen(value: boolean) {
  open.value = value
  if (value && !data.value) data.value = await load()
}

function podList(pods: string[]): string {
  return pods.length ? pods.join(', ') : '—'
}
</script>

<template>
  <UTooltip v-if="hintsEnabled" :content="{ side: 'top', sideOffset: 8, collisionPadding: 12 }" :open="open" :delay-duration="100" @update:open="onOpen">
    <button
      type="button"
      class="inline-flex shrink-0 items-center justify-center align-middle rounded-full text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors"
      :aria-label="$t(labelKey)"
    >
      <UIcon name="i-heroicons-information-circle" class="w-4 h-4 pointer-events-none" aria-hidden="true" />
    </button>

    <template #content>
      <div class="runtime-hint-content max-w-[22rem] space-y-1.5 text-xs leading-relaxed">
        <template v-if="kind === 'api' || kind === 'overview'">
          <p>{{ 'API — serves the web UI, REST API and live updates. It never runs checks.' }}</p>
          <p v-if="data?.available">{{ 'Pods:' }} <span class="font-mono">{{ podList(data.api) }}</span></p>
        </template>

        <template v-if="kind === 'worker' || kind === 'overview'">
          <p>{{ 'Worker — pulls due checks from the shared PostgreSQL queue and runs them.' }}</p>
          <p v-if="data?.available">{{ 'Pods:' }} <span class="font-mono">{{ podList(data.worker) }}</span></p>
        </template>

        <template v-if="kind === 'slots' || kind === 'overview'">
          <p>{{ 'Slots in use — checks running now divided by the total check slots across all workers (for example 0/64). One check occupies one slot until it finishes.' }}</p>
          <p v-if="data?.available">{{ 'Now:' }} <span class="font-mono">{{ data.inflight }}/{{ data.slots }}</span></p>
        </template>

        <p v-if="!data">{{ 'Loading runtime details…' }}</p>
        <p v-else-if="!data.available" class="text-secondary">{{ 'Pod names require platform administrator permission.' }}</p>
      </div>
    </template>
  </UTooltip>
</template>

<style scoped>
.runtime-hint-content {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 0.75rem 0.875rem;
  box-shadow: 0 12px 30px -12px var(--shadow-color);
  white-space: normal;
  text-align: left;
}
</style>
