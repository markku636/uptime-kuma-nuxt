<template>
  <div class="status-group">
    <!-- Group Header -->
    <button
      type="button"
      class="w-full flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-elevated transition-colors"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-3">
        <!-- Group Status Indicator -->
        <div 
          class="w-3 h-3 rounded-full"
          :class="groupStatusColor"
        />
        
        <h3 class="font-medium text-highlighted">
          {{ group.name }}
        </h3>
        
        <UBadge variant="subtle" size="xs">
          {{ group.monitors.length }} {{ $t('monitors') }}
        </UBadge>
      </div>

      <div class="flex items-center gap-3">
        <!-- Uptime Summary -->
        <div v-if="showUptime" class="text-sm text-muted">
          <span class="font-mono">{{ groupUptime.toFixed(2) }}%</span>
        </div>

        <!-- Expand Chevron -->
        <UIcon
          name="i-heroicons-chevron-down"
          class="w-5 h-5 text-dimmed transition-transform duration-200"
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
          class="flex items-center justify-between p-3 bg-default rounded-lg border border-default"
        >
          <div class="flex items-center gap-3">
            <!-- Monitor Status -->
            <Status :status="getMonitorStatus(monitor)" size="sm" />
            
            <!-- Monitor Name -->
            <div>
              <p class="font-medium text-highlighted">
                {{ monitor.name }}
              </p>
              <p v-if="monitor.description" class="text-xs text-muted">
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
      return 'bg-up'
    case 'down':
      return 'bg-down'
    case 'pending':
      return 'bg-pending'
    case 'maintenance':
      return 'bg-maintenance'
    default:
      return 'bg-unknown'
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
