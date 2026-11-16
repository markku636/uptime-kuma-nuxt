<script setup lang="ts">
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import type { Maintenance } from '~/composables/useMaintenances'

dayjs.extend(utc)
dayjs.extend(timezone)

const props = defineProps<{
  maintenance: Pick<Maintenance, 'strategy' | 'timeslotList' | 'timezone' | 'timezoneOffset' | 'status'>
}>()
const { t } = useI18n()

const FORMAT = 'YYYY-MM-DD HH:mm'

// The first slot is the running window when under maintenance, otherwise the next one
const slot = computed(() => props.maintenance.timeslotList?.[0])
const label = computed(() =>
  props.maintenance.status === 'under-maintenance' ? t('maintenanceCurrentWindow') : t('maintenanceNextWindow'),
)

function format(iso: string) {
  return dayjs(iso).tz(props.maintenance.timezone).format(FORMAT)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5 text-xs">
    <span v-if="maintenance.strategy === 'manual'" class="timeslot">{{ t('Manual') }}</span>
    <template v-else-if="slot">
      <span v-if="maintenance.strategy !== 'single'" class="text-muted">{{ label }}</span>
      <span class="timeslot font-mono">
        {{ format(slot.startDate) }}
        <span class="text-dimmed mx-1">→</span>
        {{ format(slot.endDate) }}
      </span>
      <span class="timeslot">
        UTC{{ maintenance.timezoneOffset }}
        <template v-if="maintenance.timezone !== 'UTC'"> · {{ maintenance.timezone }}</template>
      </span>
    </template>
  </div>
</template>

<style scoped>
.timeslot {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: var(--uk-radius-pill);
  background-color: var(--uk-bg-sunken);
  color: var(--uk-text-secondary);
}
</style>
