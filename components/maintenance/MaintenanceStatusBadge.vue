<script setup lang="ts">
import { MAINTENANCE_STATUS_TONE, type MaintenanceStatus } from '~/composables/useMaintenances'

const props = defineProps<{ status: MaintenanceStatus }>()
const { t } = useI18n()

const toneClass = computed(() => ({
  maintenance: 'bg-maintenance text-white',
  pending: 'bg-pending text-on-primary',
  up: 'bg-up text-on-primary',
  unknown: 'bg-unknown-subtle text-unknown-fg',
}[MAINTENANCE_STATUS_TONE[props.status]]))
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
    :class="toneClass"
  >
    {{ t(`maintenanceStatus-${status}`) }}
  </span>
</template>
