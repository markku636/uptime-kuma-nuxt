<script setup lang="ts">
import type { RuntimeHintData } from '~/composables/useRuntimeHint'

type Kind = 'api' | 'worker' | 'slots' | 'overview'

const props = withDefaults(defineProps<{ kind?: Kind }>(), { kind: 'overview' })

const { load } = useRuntimeHint()
const { t } = (useI18n as any)()
const hintsEnabled = useState<boolean>('show-runtime-hints', () => true)
const hintsLoaded = useState<boolean>('show-runtime-hints-loaded', () => false)
if (import.meta.client && !hintsLoaded.value) {
  hintsLoaded.value = true
  $fetch<any>('/api/settings/general').then(settings => { hintsEnabled.value = settings?.showRuntimeHints !== false }).catch(() => {})
}
const open = ref(false)
const data = ref<RuntimeHintData | null>(null)

const label = computed(() => {
  if (props.kind === 'api') return t('runtimeHintApi')
  if (props.kind === 'worker') return t('runtimeHintWorker')
  if (props.kind === 'slots') return t('runtimeHintSlots')
  return `${t('runtimeHintApi')} ${t('runtimeHintWorker')}`
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
      :aria-label="label"
    >
      <UIcon name="i-heroicons-information-circle" class="w-4 h-4 pointer-events-none" aria-hidden="true" />
    </button>

    <template #content>
      <div class="runtime-hint-content max-w-[22rem] space-y-1.5 text-xs leading-relaxed">
        <template v-if="kind === 'api' || kind === 'overview'">
          <p>{{ t('runtimeHintApi') }}</p>
          <p v-if="data?.available">{{ t('runtimeHintPods') }} <span class="font-mono">{{ podList(data.api) }}</span></p>
        </template>

        <template v-if="kind === 'worker' || kind === 'overview'">
          <p>{{ t('runtimeHintWorker') }}</p>
          <p v-if="data?.available">{{ t('runtimeHintPods') }} <span class="font-mono">{{ podList(data.worker) }}</span></p>
        </template>

        <template v-if="kind === 'slots' || kind === 'overview'">
          <p>{{ t('runtimeHintSlots') }}</p>
          <p v-if="data?.available">{{ t('runtimeHintNow') }} <span class="font-mono">{{ data.inflight }}/{{ data.slots }}</span></p>
        </template>

        <p v-if="!data">{{ t('runtimeHintLoading') }}</p>
        <p v-else-if="!data.available" class="text-secondary">{{ t('runtimeHintNoPermission') }}</p>
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
