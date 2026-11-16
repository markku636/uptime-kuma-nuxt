<script setup lang="ts">
// Members of a group monitor with their current status, shown on the
// group's detail page.

const props = defineProps<{
  groupId: number
}>()

const { t } = useI18n()

const { data, pending, refresh } = useFetch<{ data: any[] }>('/api/v1/monitors?heartbeats=1', {
  key: `group-members-${props.groupId}`,
  headers: useRequestHeaders(['cookie']),
})

// Keep member statuses current while the page is open
const visibility = useDocumentVisibility()
useIntervalFn(() => {
  if (visibility.value === 'visible') refresh()
}, 30_000)

const members = computed(() =>
  (data.value?.data ?? [])
    .filter(m => m.parent === props.groupId)
    .sort((a, b) => a.name.localeCompare(b.name)),
)

type Tone = 'up' | 'down' | 'maintenance' | 'pending' | 'paused'
function tone(m: any): Tone {
  if (!m.active) return 'paused'
  switch (m.heartbeats?.[0]?.status) {
    case 1: return 'up'
    case 0: return 'down'
    case 3: return 'maintenance'
    default: return 'pending'
  }
}
const dot: Record<Tone, string> = { up: 'bg-up', down: 'bg-down', maintenance: 'bg-maintenance', pending: 'bg-pending', paused: 'bg-unknown' }
const label = (m: any) => ({ up: t('Up'), down: t('Down'), maintenance: t('Maintenance'), pending: t('Pending'), paused: t('filterActivePaused') })[tone(m)]

const counts = computed(() => {
  const c = { up: 0, down: 0, other: 0 }
  for (const m of members.value) {
    const s = tone(m)
    if (s === 'up') c.up++
    else if (s === 'down') c.down++
    else c.other++
  }
  return c
})
</script>

<template>
  <section class="card">
    <header class="flex flex-wrap items-center gap-3 border-b border-default p-4">
      <h3 class="text-lg font-semibold text-highlighted">{{ t('Group members') }}</h3>
      <span class="text-sm text-muted">{{ members.length }}</span>
      <span class="flex-1" />
      <span v-if="counts.up" class="text-sm text-up-fg">{{ counts.up }} {{ t('Up') }}</span>
      <span v-if="counts.down" class="text-sm text-down-fg">{{ counts.down }} {{ t('Down') }}</span>
      <UButton :to="{ path: '/monitors/add', query: { group: groupId } }" size="sm" variant="outline" color="neutral" icon="i-heroicons-plus">
        {{ t('Add New Monitor') }}
      </UButton>
    </header>

    <div v-if="pending && !members.length" class="flex justify-center py-8">
      <div class="spinner size-6" />
    </div>
    <p v-else-if="!members.length" class="px-4 py-8 text-center text-sm text-muted">
      {{ t('groupEmptyHint') }}
    </p>
    <ul v-else class="divide-y divide-(--uk-border)">
      <li v-for="member in members" :key="member.id">
        <NuxtLink :to="`/monitors/${member.id}`" class="flex items-center gap-3 px-4 py-2.5 hover:bg-elevated">
          <span class="size-2.5 shrink-0 rounded-full" :class="dot[tone(member)]" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-default">{{ member.name }}</span>
          <span class="hidden text-xs uppercase text-muted sm:inline">{{ member.type }}</span>
          <span class="w-20 text-right text-xs text-muted">{{ label(member) }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
