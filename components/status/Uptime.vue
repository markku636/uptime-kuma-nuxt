<template>
  <span :class="className" :title="title">{{ formattedUptime }}</span>
</template>

<script setup lang="ts">
interface Props {
  /** 
   * Uptime percentage (0-1 or 0-100).
   * If value > 1, it's treated as percentage (0-100).
   * If value <= 1, it's treated as decimal (0-1).
   */
  percentage?: number
  /** Monitor ID - used to fetch uptime from store */
  monitorId?: number
  /** Type of uptime period: 24h, 30d, or 1y */
  type?: '24' | '720' | '1y'
  /** Show as pill badge */
  pill?: boolean
  /** Status for coloring (0=down, 1=up, 2=pending, 3=maintenance) */
  status?: number
  /** Display style: percentage (default) or nines */
  displayStyle?: 'percentage' | 'nines'
}

const props = withDefaults(defineProps<Props>(), {
  type: '24',
  pill: false,
  displayStyle: 'percentage'
})

const { t } = useI18n()
const { appearanceSettings, loadAppearanceSettings } = useAppearanceSettings()

// Ensure appearance settings are loaded so display style follows preference
onMounted(() => {
  loadAppearanceSettings()
})

// Calculate uptime value
const uptimeValue = computed(() => {
  // Direct percentage provided
  if (props.percentage !== undefined) {
    // Normalize to 0-100 range
    return props.percentage > 1 ? props.percentage : props.percentage * 100
  }
  
  // TODO: Fetch from uptime store by monitorId if needed
  return null
})

const formattedUptime = computed(() => {
  if (uptimeValue.value === null || uptimeValue.value === undefined) {
    return t('N/A')
  }

  const value = Math.min(100, Math.round(uptimeValue.value * 100) / 100)
  const style = props.displayStyle || appearanceSettings.value.uptimeDisplayStyle || 'percentage'

  if (style === 'nines') {
    // Calculate number of nines based on downtime fraction
    const downtime = 100 - value
    if (downtime <= 0) {
      return `${t('Nines', 'Nines')}: ∞`
    }
    const nines = Math.max(0, Math.floor(-Math.log10(downtime / 100)))
    return `${nines} ${t('nines', 'nines')}`
  }

  return `${value.toFixed(2)}%`
})

const color = computed(() => {
  // Use status if provided
  if (props.status !== undefined) {
    switch (props.status) {
      case 0: return 'danger'
      case 1: return 'primary'
      case 2: return 'warning'
      case 3: return 'maintenance'
      default: return 'secondary'
    }
  }
  
  // Color based on uptime percentage
  if (uptimeValue.value === null) return 'secondary'
  if (uptimeValue.value >= 99) return 'primary'
  if (uptimeValue.value >= 95) return 'warning'
  return 'danger'
})

const className = computed(() => {
  if (props.pill) {
    return `uptime-badge badge rounded-pill bg-${color.value}`
  }
  return `uptime-text text-${color.value}`
})

const title = computed(() => {
  switch (props.type) {
    case '1y': return t('1 Year Uptime')
    case '720': return t('30 Day Uptime')
    case '24':
    default: return t('24 Hour Uptime')
  }
})
</script>

<style scoped>
.uptime-badge {
  min-width: 62px;
  font-weight: 500;
}

.uptime-text {
  font-weight: 500;
  font-family: var(--font-mono, monospace);
}

.text-primary {
  color: #5cdd8b !important;
}

.text-warning {
  color: #f8a306 !important;
}

.text-danger {
  color: #dc3545 !important;
}

.text-secondary {
  color: #6c757d !important;
}

.text-maintenance {
  color: #1747f5 !important;
}

.bg-primary {
  background-color: #5cdd8b !important;
}

.bg-warning {
  background-color: #f8a306 !important;
}

.bg-danger {
  background-color: #dc3545 !important;
}

.bg-secondary {
  background-color: #6c757d !important;
}

.bg-maintenance {
  background-color: #1747f5 !important;
}
</style>
