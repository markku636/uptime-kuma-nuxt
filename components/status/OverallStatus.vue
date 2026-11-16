<template>
  <div class="overall-status p-4 rounded-lg" :class="statusStyles.bg">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div 
          class="w-10 h-10 rounded-full flex items-center justify-center"
          :class="statusStyles.icon"
        >
          <UIcon :name="statusIcon" class="w-6 h-6" />
        </div>
        <div>
          <h3 class="font-semibold text-lg" :class="statusStyles.text">
            {{ statusText }}
          </h3>
          <p v-if="subtitle" class="text-sm opacity-75" :class="statusStyles.text">
            {{ subtitle }}
          </p>
        </div>
      </div>
      
      <div v-if="showLastUpdated" class="text-right">
        <p class="text-xs text-muted">{{ $t('Last updated') }}</p>
        <p class="text-sm font-mono">{{ formattedLastUpdate }}</p>
      </div>
    </div>

    <!-- Optional details -->
    <div v-if="showDetails && stats" class="mt-4 grid grid-cols-3 gap-4">
      <div class="text-center">
        <p class="text-2xl font-bold text-up-fg">{{ stats.up }}</p>
        <p class="text-xs text-muted">{{ $t('Operational') }}</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-pending-fg">{{ stats.degraded }}</p>
        <p class="text-xs text-muted">{{ $t('Degraded') }}</p>
      </div>
      <div class="text-center">
        <p class="text-2xl font-bold text-down-fg">{{ stats.down }}</p>
        <p class="text-xs text-muted">{{ $t('Outage') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type OverallStatusType = 'operational' | 'degraded' | 'partial-outage' | 'major-outage' | 'maintenance' | 'unknown'

interface Stats {
  up: number
  degraded: number
  down: number
}

const props = withDefaults(defineProps<{
  status: OverallStatusType
  subtitle?: string
  showLastUpdated?: boolean
  lastUpdated?: Date | string
  showDetails?: boolean
  stats?: Stats
}>(), {
  status: 'unknown',
  showLastUpdated: true,
  showDetails: false,
})

const { t } = useI18n()

const statusText = computed(() => {
  switch (props.status) {
    case 'operational':
      return t('All Systems Operational')
    case 'degraded':
      return t('Degraded Performance')
    case 'partial-outage':
      return t('Partial System Outage')
    case 'major-outage':
      return t('Major System Outage')
    case 'maintenance':
      return t('Under Maintenance')
    default:
      return t('Status Unknown')
  }
})

const statusIcon = computed(() => {
  switch (props.status) {
    case 'operational':
      return 'i-heroicons-check-circle'
    case 'degraded':
      return 'i-heroicons-exclamation-circle'
    case 'partial-outage':
      return 'i-heroicons-exclamation-triangle'
    case 'major-outage':
      return 'i-heroicons-x-circle'
    case 'maintenance':
      return 'i-heroicons-wrench-screwdriver'
    default:
      return 'i-heroicons-question-mark-circle'
  }
})

const statusStyles = computed(() => {
  switch (props.status) {
    case 'operational':
      return {
        bg: 'bg-up-subtle',
        icon: 'bg-up-subtle text-up-fg',
        text: 'text-up-fg'
      }
    case 'degraded':
      return {
        bg: 'bg-pending-subtle',
        icon: 'bg-pending-subtle text-pending-fg',
        text: 'text-pending-fg'
      }
    case 'partial-outage':
      return {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        icon: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600',
        text: 'text-orange-800 dark:text-orange-200'
      }
    case 'major-outage':
      return {
        bg: 'bg-down-subtle',
        icon: 'bg-down-subtle text-down-fg',
        text: 'text-down-fg'
      }
    case 'maintenance':
      return {
        bg: 'bg-maintenance-subtle',
        icon: 'bg-maintenance-subtle text-maintenance-fg',
        text: 'text-maintenance-fg'
      }
    default:
      return {
        bg: 'bg-muted',
        icon: 'bg-elevated text-toned',
        text: 'text-highlighted'
      }
  }
})

const formattedLastUpdate = computed(() => {
  if (!props.lastUpdated) return '-'
  const date = typeof props.lastUpdated === 'string' 
    ? new Date(props.lastUpdated) 
    : props.lastUpdated
  return date.toLocaleString()
})
</script>
