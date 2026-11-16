<script setup lang="ts">
import type { Maintenance } from '~/composables/useMaintenances'
import { errorMessage } from '~/composables/useMaintenances'

definePageMeta({
  middleware: ['auth']
})

const { t } = useI18n()
const toast = useToast()
const { sortedMaintenances, isLoading, error, setActive, deleteMaintenance } = useMaintenances()

// Filters: status tab + text search (remembered for this browser tab)
type Filter = 'all' | 'under-maintenance' | 'scheduled' | 'inactive' | 'ended'
const filter = useState<Filter>('maintenance-filter', () => 'all')
const search = ref('')

const filterTabs = computed(() => {
  const count = (status?: string) => sortedMaintenances.value.filter(m => !status || m.status === status).length
  return [
    { value: 'all' as Filter, label: t('maintenanceFilterAll'), count: count() },
    { value: 'under-maintenance' as Filter, label: t('maintenanceStatus-under-maintenance'), count: count('under-maintenance') },
    { value: 'scheduled' as Filter, label: t('maintenanceStatus-scheduled'), count: count('scheduled') },
    { value: 'inactive' as Filter, label: t('maintenanceStatus-inactive'), count: count('inactive') },
    { value: 'ended' as Filter, label: t('maintenanceStatus-ended'), count: count('ended') },
  ]
})

const visibleMaintenances = computed(() => {
  const q = search.value.trim().toLowerCase()
  return sortedMaintenances.value.filter(m =>
    (filter.value === 'all' || m.status === filter.value)
    && (!q || m.title.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)))
})

const pending = ref<{ action: 'pause' | 'delete'; item: Maintenance } | null>(null)
const busyId = ref<number | null>(null)

const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (v: boolean) => { if (!v) pending.value = null },
})

async function resume(item: Maintenance) {
  busyId.value = item.id
  try {
    await setActive(item.id, true)
  } catch (e) {
    toast.add({ title: errorMessage(e, 'Failed to resume'), color: 'error' })
  } finally {
    busyId.value = null
  }
}

async function confirmAction() {
  if (!pending.value) return
  const { action, item } = pending.value
  busyId.value = item.id
  try {
    if (action === 'pause') {
      await setActive(item.id, false)
    } else {
      await deleteMaintenance(item.id)
      toast.add({ title: t('maintenanceDeleted'), color: 'success' })
    }
    pending.value = null
  } catch (e) {
    toast.add({ title: errorMessage(e, 'Request failed'), color: 'error' })
  } finally {
    busyId.value = null
  }
}

const statusBar: Record<string, string> = {
  'under-maintenance': 'bg-maintenance',
  scheduled: 'bg-pending',
  inactive: 'bg-unknown',
  ended: 'bg-unknown',
  unknown: 'bg-unknown',
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-highlighted">{{ t('Maintenance') }}</h1>
      <UButton to="/maintenance/add" icon="i-heroicons-plus">{{ t('Schedule Maintenance') }}</UButton>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" :title="error" class="mb-4" />

    <div v-if="sortedMaintenances.length > 0" class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex flex-wrap gap-1" role="tablist">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="filter === tab.value"
          class="filter-tab"
          :class="{ 'filter-tab-active': filter === tab.value }"
          @click="filter = tab.value"
        >
          {{ tab.label }}
          <span class="filter-count">{{ tab.count }}</span>
        </button>
      </div>
      <UInput v-model="search" icon="i-heroicons-magnifying-glass" :placeholder="t('Search...')" class="sm:w-64" />
    </div>

    <div class="card overflow-hidden">
      <div v-if="isLoading && sortedMaintenances.length === 0" class="flex justify-center py-16">
        <div class="spinner size-8" />
      </div>

      <div v-else-if="sortedMaintenances.length === 0" class="px-6 py-16 text-center">
        <UIcon name="i-heroicons-wrench-screwdriver" class="mx-auto size-10 text-dimmed" />
        <p class="mt-3 text-muted">{{ t('No Maintenance') }}</p>
      </div>

      <div v-else-if="visibleMaintenances.length === 0" class="px-6 py-12 text-center text-muted">
        {{ t('maintenanceNoMatch') }}
      </div>

      <ul v-else class="divide-y divide-(--uk-border)">
        <li
          v-for="item in visibleMaintenances"
          :key="item.id"
          class="relative flex flex-col gap-3 py-4 pr-4 pl-5 sm:flex-row sm:items-center"
          :class="{ 'opacity-70': item.status === 'ended' || item.status === 'inactive' }"
        >
          <span class="absolute inset-y-3 left-0 w-1 rounded-r" :class="statusBar[item.status]" aria-hidden="true" />

          <NuxtLink :to="`/maintenance/${item.id}`" class="min-w-0 flex-1 space-y-1.5 hover:no-underline">
            <div class="flex flex-wrap items-center gap-2">
              <MaintenanceStatusBadge :status="item.status" />
              <span class="truncate font-medium text-highlighted">{{ item.title }}</span>
            </div>
            <MaintenanceTime :maintenance="item" />
          </NuxtLink>

          <div class="flex shrink-0 flex-wrap gap-1.5">
            <UButton
              v-if="item.active"
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-heroicons-pause"
              :loading="busyId === item.id"
              @click="pending = { action: 'pause', item }"
            >
              {{ t('Pause') }}
            </UButton>
            <UButton
              v-else
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-heroicons-play"
              :loading="busyId === item.id"
              @click="resume(item)"
            >
              {{ t('Resume') }}
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" icon="i-heroicons-document-duplicate" :to="`/maintenance/add?cloneId=${item.id}`">
              {{ t('Clone') }}
            </UButton>
            <UButton size="sm" color="neutral" variant="outline" icon="i-heroicons-pencil-square" :to="`/maintenance/${item.id}/edit`">
              {{ t('Edit') }}
            </UButton>
            <UButton size="sm" color="error" variant="soft" icon="i-heroicons-trash" @click="pending = { action: 'delete', item }">
              {{ t('Delete') }}
            </UButton>
          </div>
        </li>
      </ul>
    </div>

    <CommonConfirmDialog
      v-model:open="confirmOpen"
      :title="pending?.item.title"
      :message="pending?.action === 'delete' ? t('deleteMaintenanceMsg') : t('pauseMaintenanceMsg')"
      :type="pending?.action === 'delete' ? 'danger' : 'warning'"
      :confirm-text="t('Yes')"
      :cancel-text="t('No')"
      :loading="busyId !== null"
      @confirm="confirmAction"
    />
  </div>
</template>

<style scoped>
.filter-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--uk-radius-pill);
  font-size: 0.875rem;
  color: var(--uk-text-secondary);
  transition: background-color var(--uk-duration-fast) ease, color var(--uk-duration-fast) ease;
}

.filter-tab:hover {
  background-color: var(--uk-bg-hover);
  color: var(--uk-text);
}

.filter-tab-active,
.filter-tab-active:hover {
  background-color: color-mix(in srgb, var(--uk-primary) 14%, transparent);
  color: var(--uk-primary-fg);
  font-weight: 600;
}

.filter-count {
  min-width: 1.25rem;
  padding: 0 0.375rem;
  border-radius: var(--uk-radius-pill);
  background-color: var(--uk-bg-sunken);
  font-size: 0.75rem;
  line-height: 1.25rem;
  text-align: center;
}
</style>
