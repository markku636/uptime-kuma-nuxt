<script setup lang="ts">
// Shows the maintenance windows that cover a monitor (directly or through its
// parent group): an alert while one is active, and the next upcoming window.
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { Maintenance } from '~/composables/useMaintenances'

dayjs.extend(utc)
dayjs.extend(timezone)

const props = defineProps<{
  monitorId: number
  /** Parent group id; maintenance on the group also covers this monitor */
  parentId?: number | null
}>()

const { t } = useI18n()
const { maintenances } = useMaintenances({ live: false })

const UPCOMING_DAYS = 7

const covering = computed(() => {
  const ids = new Set([props.monitorId, ...(props.parentId ? [props.parentId] : [])])
  return maintenances.value.filter(m => m.active && m.monitors?.some(id => ids.has(id)))
})

const active = computed(() => covering.value.filter(m => m.status === 'under-maintenance'))

const upcoming = computed(() => {
  const limit = dayjs().add(UPCOMING_DAYS, 'day')
  return covering.value
    .filter(m => m.status === 'scheduled' && m.timeslotList[0] && dayjs(m.timeslotList[0].startDate).isBefore(limit))
    .sort((a, b) => a.timeslotList[0].startDate.localeCompare(b.timeslotList[0].startDate))
    .slice(0, 3)
})

function slotText(m: Maintenance) {
  const slot = m.timeslotList[0]
  if (!slot) return t('Manual')
  const fmt = (iso: string) => dayjs(iso).tz(m.timezone).format('MM-DD HH:mm')
  return `${fmt(slot.startDate)} → ${fmt(slot.endDate)} (UTC${m.timezoneOffset})`
}
</script>

<template>
  <div v-if="active.length || upcoming.length" class="mb-6 space-y-2">
    <NuxtLink
      v-for="m in active"
      :key="m.id"
      :to="`/maintenance/${m.id}`"
      class="flex items-start gap-3 rounded-lg border border-maintenance/40 bg-maintenance-subtle px-4 py-3 hover:no-underline"
    >
      <UIcon name="i-heroicons-wrench-screwdriver" class="mt-0.5 size-5 shrink-0 text-maintenance-fg" />
      <div class="min-w-0">
        <p class="font-medium text-maintenance-fg">{{ t('maintenanceMonitorActive', { title: m.title }) }}</p>
        <p class="text-sm text-toned">{{ slotText(m) }} · {{ t('maintenanceMonitorActiveHint') }}</p>
      </div>
    </NuxtLink>

    <NuxtLink
      v-for="m in upcoming"
      :key="m.id"
      :to="`/maintenance/${m.id}`"
      class="flex items-center gap-3 rounded-lg border border-default bg-sunken px-4 py-2.5 text-sm hover:no-underline hover:border-accented"
    >
      <UIcon name="i-heroicons-calendar-days" class="size-4 shrink-0 text-pending-fg" />
      <span class="text-toned">{{ t('maintenanceMonitorUpcoming') }}</span>
      <span class="truncate font-medium text-default">{{ m.title }}</span>
      <span class="ml-auto shrink-0 font-mono text-xs text-muted">{{ slotText(m) }}</span>
    </NuxtLink>
  </div>
</template>
