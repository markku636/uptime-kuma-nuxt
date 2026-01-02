<template>
  <div
    class="monitor-list-item group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors"
    :class="[
      isSelected ? 'bg-primary-100 dark:bg-primary-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800',
      { 'opacity-50': monitor.active === false }
    ]"
    @click="$emit('select', monitor)"
  >
    <!-- Status Indicator -->
    <Status :status="monitorStatus" size="sm" />

    <!-- Monitor Info -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <!-- Monitor Name -->
        <span class="font-medium truncate text-gray-900 dark:text-gray-100">
          {{ monitor.name }}
        </span>
        
        <!-- Monitor Type Badge -->
        <UBadge v-if="showType" variant="subtle" size="xs">
          {{ monitor.type }}
        </UBadge>
        
        <!-- Paused Badge -->
        <UBadge v-if="monitor.active === false" variant="outline" size="xs" color="warning">
          {{ $t('Paused') }}
        </UBadge>
      </div>
      
      <!-- URL or Description -->
      <p v-if="monitor.url || monitor.hostname" class="text-xs text-gray-500 dark:text-gray-400 truncate">
        {{ monitor.url || monitor.hostname }}
      </p>
    </div>

    <!-- Tags -->
    <div v-if="monitor.tags?.length && showTags" class="hidden sm:flex gap-1">
      <Tag
        v-for="tag in displayTags"
        :key="tag.id"
        :name="tag.name"
        :color="tag.color"
        size="xs"
      />
      <UBadge v-if="hiddenTagsCount > 0" variant="subtle" size="xs">
        +{{ hiddenTagsCount }}
      </UBadge>
    </div>

    <!-- Response Time -->
    <div v-if="showPing && latestPing !== null" class="text-right min-w-[60px]">
      <span 
        class="text-sm font-mono"
        :class="pingColor"
      >
        {{ latestPing }}ms
      </span>
    </div>

    <!-- Uptime -->
    <Uptime
      v-if="showUptime && uptimePercentage !== null"
      :percentage="uptimePercentage"
      size="sm"
    />

    <!-- Actions -->
    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
      <UDropdownMenu :items="actionItems">
        <UButton variant="ghost" icon="i-heroicons-ellipsis-vertical" size="xs" />
      </UDropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MonitorTag {
  id: number
  name: string
  color: string
}

interface Monitor {
  id: number
  name: string
  type: string
  url?: string
  hostname?: string
  active?: boolean
  tags?: MonitorTag[]
}

const props = withDefaults(defineProps<{
  monitor: Monitor
  isSelected?: boolean
  showType?: boolean
  showTags?: boolean
  showPing?: boolean
  showUptime?: boolean
  latestPing?: number | null
  uptimePercentage?: number | null
  maxTags?: number
}>(), {
  isSelected: false,
  showType: false,
  showTags: true,
  showPing: true,
  showUptime: true,
  latestPing: null,
  uptimePercentage: null,
  maxTags: 3
})

const emit = defineEmits<{
  (e: 'select', monitor: Monitor): void
  (e: 'edit', monitor: Monitor): void
  (e: 'delete', monitor: Monitor): void
  (e: 'pause', monitor: Monitor): void
  (e: 'resume', monitor: Monitor): void
}>()

const { t } = useI18n()

// Computed status based on latest heartbeat
const monitorStatus = computed(() => {
  if (props.monitor.active === false) return 'paused'
  if (props.latestPing === null) return 'pending'
  return 'up' // Would need actual heartbeat status
})

// Display limited tags
const displayTags = computed(() => {
  return props.monitor.tags?.slice(0, props.maxTags) || []
})

const hiddenTagsCount = computed(() => {
  const total = props.monitor.tags?.length || 0
  return Math.max(0, total - props.maxTags)
})

// Ping color based on response time
const pingColor = computed(() => {
  const ping = props.latestPing
  if (ping === null) return 'text-gray-400'
  if (ping < 100) return 'text-green-500'
  if (ping < 500) return 'text-yellow-500'
  if (ping < 1000) return 'text-orange-500'
  return 'text-red-500'
})

// Action dropdown items
const actionItems = computed(() => [
  [
    {
      label: t('Edit'),
      icon: 'i-heroicons-pencil',
      onSelect: () => emit('edit', props.monitor)
    },
    {
      label: props.monitor.active === false ? t('Resume') : t('Pause'),
      icon: props.monitor.active === false ? 'i-heroicons-play' : 'i-heroicons-pause',
      onSelect: () => {
        if (props.monitor.active === false) {
          emit('resume', props.monitor)
        } else {
          emit('pause', props.monitor)
        }
      }
    }
  ],
  [
    {
      label: t('Delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => emit('delete', props.monitor)
    }
  ]
])
</script>

<style scoped>
.monitor-list-item {
  border: 1px solid transparent;
}

.monitor-list-item:focus {
  outline: none;
  border-color: var(--color-primary-500);
}
</style>
