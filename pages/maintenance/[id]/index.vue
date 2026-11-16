<script setup lang="ts">
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { Maintenance } from '~/composables/useMaintenances'
import { errorMessage } from '~/composables/useMaintenances'

dayjs.extend(utc)
dayjs.extend(timezone)

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = useI18n()
const { renderMarkdown } = useMarkdown()
const { getMaintenance, setActive, deleteMaintenance } = useMaintenances({ autoFetch: false, live: false })

const id = computed(() => Number(route.params.id))
const maintenance = ref<Maintenance | null>(null)
const monitorNames = ref<Record<number, string>>({})
const statusPageNames = ref<Record<number, string>>({})
const loading = ref(true)
const loadError = ref<string | null>(null)
const busy = ref(false)
const confirm = ref<'pause' | 'delete' | null>(null)

const confirmOpen = computed({
  get: () => confirm.value !== null,
  set: (v: boolean) => { if (!v) confirm.value = null },
})

async function load() {
  loadError.value = null
  try {
    const [m, monitors, pages] = await Promise.all([
      getMaintenance(id.value),
      $fetch<{ data: { id: number; name: string }[] }>('/api/v1/monitors'),
      $fetch<{ data: { id: number; title: string }[] }>('/api/v1/status-pages'),
    ])
    maintenance.value = m
    monitorNames.value = Object.fromEntries((monitors.data || []).map(x => [x.id, x.name]))
    statusPageNames.value = Object.fromEntries((pages.data || []).map(x => [x.id, x.title]))
  } catch (e) {
    loadError.value = errorMessage(e, 'Failed to load maintenance')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const strategyLabel = computed(() => {
  const m = maintenance.value
  if (!m) return ''
  switch (m.strategy) {
    case 'manual': return t('strategyManual')
    case 'single': return t('Single Maintenance Window')
    case 'cron': return `${t('cronExpression')}: ${m.cron}`
    case 'recurring-interval': return `${t('Recurring')} - ${t('recurringIntervalMessage', [m.intervalDay], m.intervalDay)}`
    case 'recurring-weekday': return `${t('Recurring')} - ${t('dayOfWeek')}`
    case 'recurring-day-of-month': return `${t('Recurring')} - ${t('dayOfMonth')}`
    default: return m.strategy
  }
})

const weekdayKeys = ['weekdayShortSun', 'weekdayShortMon', 'weekdayShortTue', 'weekdayShortWed', 'weekdayShortThu', 'weekdayShortFri', 'weekdayShortSat']
const pad = (n: number) => String(n).padStart(2, '0')

const scheduleDetail = computed(() => {
  const m = maintenance.value
  if (!m) return ''
  const window = m.timeRange ? `${pad(m.timeRange[0].hours)}:${pad(m.timeRange[0].minutes)} → ${pad(m.timeRange[1].hours)}:${pad(m.timeRange[1].minutes)}` : ''
  if (m.strategy === 'recurring-weekday') return `${m.weekdays.map(d => t(weekdayKeys[d % 7])).join(', ')} · ${window}`
  if (m.strategy === 'recurring-day-of-month') return `${m.daysOfMonth.map(d => (d === 'lastDay1' ? t('lastDay1') : d)).join(', ')} · ${window}`
  if (m.strategy === 'recurring-interval') return window
  if (m.strategy === 'cron') return t('minuteShort', { n: m.durationMinutes }, m.durationMinutes)
  return ''
})

const dateRangeText = computed(() => {
  const [start, end] = maintenance.value?.dateRange || []
  if (!start && !end) return ''
  return `${start || '…'} → ${end || '…'}`
})

function fmt(iso: string) {
  return maintenance.value ? dayjs(iso).tz(maintenance.value.timezone).format('YYYY-MM-DD HH:mm') : iso
}

async function resume() {
  busy.value = true
  try {
    maintenance.value = await setActive(id.value, true)
  } catch (e) {
    toast.add({ title: errorMessage(e, 'Failed to resume'), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function confirmAction() {
  busy.value = true
  try {
    if (confirm.value === 'pause') {
      maintenance.value = await setActive(id.value, false)
    } else if (confirm.value === 'delete') {
      await deleteMaintenance(id.value)
      toast.add({ title: t('maintenanceDeleted'), color: 'success' })
      router.push('/maintenance')
    }
    confirm.value = null
  } catch (e) {
    toast.add({ title: errorMessage(e, 'Request failed'), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-6">
    <NuxtLink to="/maintenance" class="inline-flex items-center gap-1 text-sm text-muted hover:text-default">
      <UIcon name="i-heroicons-arrow-left" class="size-4" />
      {{ t('Maintenance') }}
    </NuxtLink>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="spinner size-8" />
    </div>

    <UAlert v-else-if="loadError" class="mt-4" color="error" variant="subtle" :title="loadError" icon="i-heroicons-exclamation-triangle" />

    <div v-else-if="maintenance" class="mt-2 space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0 space-y-2">
          <h1 class="text-2xl font-semibold break-words text-highlighted">{{ maintenance.title }}</h1>
          <div class="flex flex-wrap items-center gap-2">
            <MaintenanceStatusBadge :status="maintenance.status" />
            <span class="text-sm text-muted">{{ strategyLabel }}</span>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap gap-1.5">
          <UButton v-if="maintenance.active" color="neutral" variant="outline" icon="i-heroicons-pause" :loading="busy" @click="confirm = 'pause'">
            {{ t('Pause') }}
          </UButton>
          <UButton v-else icon="i-heroicons-play" :loading="busy" @click="resume">{{ t('Resume') }}</UButton>
          <UButton color="neutral" variant="outline" icon="i-heroicons-document-duplicate" :to="`/maintenance/add?cloneId=${id}`">{{ t('Clone') }}</UButton>
          <UButton color="neutral" variant="outline" icon="i-heroicons-pencil-square" :to="`/maintenance/${id}/edit`">{{ t('Edit') }}</UButton>
          <UButton color="error" variant="soft" icon="i-heroicons-trash" @click="confirm = 'delete'">{{ t('Delete') }}</UButton>
        </div>
      </div>

      <!-- Description -->
      <div
        v-if="maintenance.description"
        class="card card-body prose prose-sm max-w-none dark:prose-invert"
        v-html="renderMarkdown(maintenance.description)"
      />

      <!-- Schedule -->
      <!-- Manual maintenances have no schedule; the strategy is already in the subtitle -->
      <section v-if="maintenance.strategy !== 'manual'" class="card card-body space-y-3">
        <h2 class="font-semibold text-highlighted">{{ t('Strategy') }}</h2>
        <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
          <template v-if="scheduleDetail">
            <dt class="text-muted">{{ t('Maintenance Time Window of a Day') }}</dt>
            <dd class="text-default">{{ scheduleDetail }}</dd>
          </template>
          <template v-if="dateRangeText">
            <dt class="text-muted">{{ maintenance.strategy === 'single' ? t('Date and Time') : t('Effective Date Range') }}</dt>
            <dd class="font-mono text-default">{{ dateRangeText }}</dd>
          </template>
          <template v-if="maintenance.strategy !== 'manual'">
            <dt class="text-muted">{{ t('Timezone') }}</dt>
            <dd class="text-default">{{ maintenance.timezone }} (UTC{{ maintenance.timezoneOffset }})</dd>
          </template>
        </dl>

        <ul v-if="maintenance.timeslotList.length" class="space-y-1.5 pt-1">
          <li
            v-for="(slot, i) in maintenance.timeslotList"
            :key="slot.startDate"
            class="flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm"
            :class="i === 0 && maintenance.status === 'under-maintenance' ? 'bg-maintenance-subtle text-maintenance-fg' : 'bg-sunken text-toned'"
          >
            <span class="font-medium">
              {{ i === 0 && maintenance.status === 'under-maintenance' ? t('maintenanceCurrentWindow') : t('maintenanceNextWindow') }}
            </span>
            <span class="font-mono">{{ fmt(slot.startDate) }} → {{ fmt(slot.endDate) }}</span>
          </li>
        </ul>
      </section>

      <!-- Affected -->
      <section class="card card-body space-y-4">
        <h2 class="font-semibold text-highlighted">{{ t('Affected Monitors') }}</h2>
        <p v-if="!maintenance.monitors?.length" class="text-sm text-muted">{{ t('maintenanceNoAffectedMonitors') }}</p>
        <div v-else class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="monitorId in maintenance.monitors"
            :key="monitorId"
            :to="`/monitors/${monitorId}`"
            class="rounded-full border border-default bg-sunken px-3 py-1 text-sm text-default hover:border-accented"
          >
            {{ monitorNames[monitorId] || `#${monitorId}` }}
          </NuxtLink>
        </div>

        <template v-if="maintenance.statusPages?.length">
          <h3 class="pt-2 text-sm font-medium text-toned">{{ t('affectedStatusPages') }}</h3>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="pageId in maintenance.statusPages"
              :key="pageId"
              class="rounded-full border border-default bg-sunken px-3 py-1 text-sm text-default"
            >
              {{ statusPageNames[pageId] || `#${pageId}` }}
            </span>
          </div>
        </template>
      </section>
    </div>

    <CommonConfirmDialog
      v-model:open="confirmOpen"
      :title="maintenance?.title"
      :message="confirm === 'delete' ? t('deleteMaintenanceMsg') : t('pauseMaintenanceMsg')"
      :type="confirm === 'delete' ? 'danger' : 'warning'"
      :confirm-text="t('Yes')"
      :cancel-text="t('No')"
      :loading="busy"
      @confirm="confirmAction"
    />
  </div>
</template>
