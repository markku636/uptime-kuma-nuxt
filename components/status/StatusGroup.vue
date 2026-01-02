<template>
  <div class="status-group">
    <!-- Group Header -->
    <button
      type="button"
      class="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-3">
        <!-- Group Status Indicator -->
        <div 
          class="w-3 h-3 rounded-full"
          :class="groupStatusColor"
        />
        
        <h3 class="font-medium text-gray-900 dark:text-gray-100">
          {{ group.name }}
        </h3>
        
        <UBadge variant="subtle" size="xs">
          {{ group.monitors.length }} {{ $t('monitors') }}
        </UBadge>
      </div>

      <div class="flex items-center gap-3">
        <!-- Uptime Summary -->
        <div v-if="showUptime" class="text-sm text-gray-500">
          <span class="font-mono">{{ groupUptime.toFixed(2) }}%</span>
        </div>

        <!-- Expand Chevron -->
        <UIcon
          name="i-heroicons-chevron-down"
          class="w-5 h-5 text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-180': isExpanded }"
        />
      </div>
    </button>

    <!-- Monitors List -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 max-h-0"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="isExpanded" class="mt-2 ml-6 space-y-2 overflow-hidden">
        <div
          v-for="monitor in group.monitors"
          :key="monitor.id"
          class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <!-- Monitor Status -->
            <Status :status="getMonitorStatus(monitor)" size="sm" />
            
            <!-- Monitor Name -->
            <div>
              <p class="font-medium text-gray-900 dark:text-gray-100">
                {{ monitor.name }}
              </p>
              <p v-if="monitor.description" class="text-xs text-gray-500">
                {{ monitor.description }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <!-- Heartbeat Bar -->
            <HeartbeatBar
              v-if="showHeartbeats"
              :beats="monitor.heartbeats || []"
              :max-beats="30"
              size="sm"
            />

            <!-- Uptime -->
            <Uptime
              v-if="showUptime && monitor.uptime !== undefined"
              :percentage="monitor.uptime"
              size="sm"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
interface Monitor {
  id: number
  name: string
  description?: string
  status?: number // 0: down, 1: up, 2: pending, 3: maintenance
  uptime?: number
  heartbeats?: Array<{ status: number; time?: string; ping?: number }>
}

interface MonitorGroup {
  id: number
  name: string
  monitors: Monitor[]
}

const props = withDefaults(defineProps<{
  group: MonitorGroup
  defaultExpanded?: boolean
  showUptime?: boolean
  showHeartbeats?: boolean
}>(), {
  defaultExpanded: true,
  showUptime: true,
  showHeartbeats: true,
})

const isExpanded = ref(props.defaultExpanded)

// Calculate group status based on monitors
const groupStatus = computed(() => {
  const monitors = props.group.monitors
  if (!monitors.length) return 'unknown'
  
  const hasDown = monitors.some(m => m.status === 0)
  const hasMaintenance = monitors.some(m => m.status === 3)
  const hasPending = monitors.some(m => m.status === 2)
  
  if (hasDown) return 'down'
  if (hasMaintenance) return 'maintenance'
  if (hasPending) return 'pending'
  return 'up'
})

const groupStatusColor = computed(() => {
  switch (groupStatus.value) {
    case 'up':
      return 'bg-green-500'
    case 'down':
      return 'bg-red-500'
    case 'pending':
      return 'bg-yellow-500'
    case 'maintenance':
      return 'bg-blue-500'
    default:
      return 'bg-gray-400'
  }
})

// Calculate average uptime for the group
const groupUptime = computed(() => {
  const monitors = props.group.monitors.filter(m => m.uptime !== undefined)
  if (!monitors.length) return 100
  
  const total = monitors.reduce((sum, m) => sum + (m.uptime || 0), 0)
  return total / monitors.length
})

function getMonitorStatus(monitor: Monitor): string {
  switch (monitor.status) {
    case 1:
      return 'up'
    case 0:
      return 'down'
    case 2:
      return 'pending'
    case 3:
      return 'maintenance'
    default:
      return 'pending'
  }
}
</script>
