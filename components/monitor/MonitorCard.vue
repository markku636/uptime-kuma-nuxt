<template>
  <div class="monitor-card">
    <div class="d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-3">
        <!-- Status indicator -->
        <span class="status-dot" :class="statusColor"></span>
        
        <div>
          <NuxtLink :to="`/dashboard/${monitor.id}`" class="monitor-name">
            {{ monitor.name }}
          </NuxtLink>
          <div class="monitor-meta">
            <span class="badge bg-secondary me-1">{{ monitor.type.toUpperCase() }}</span>
            {{ monitor.url || monitor.hostname }}
          </div>
        </div>
      </div>

      <div class="d-flex align-items-center gap-3">
        <!-- Heartbeat bar (last 30 heartbeats) -->
        <HeartbeatBar :heartbeats="monitor.heartbeats?.slice(0, 30) || []" />

        <!-- Uptime percentage -->
        <div class="uptime-display">
          <span :class="uptimeColor">{{ uptimePercentage }}%</span>
        </div>

        <!-- Actions -->
        <div v-if="showActions" class="d-flex align-items-center gap-1">
          <button
            v-if="monitor.active"
            class="btn btn-outline-secondary btn-sm"
            title="Pause"
            @click="handlePause"
          >
            <i class="fas fa-pause"></i>
          </button>
          <button
            v-else
            class="btn btn-outline-secondary btn-sm"
            title="Resume"
            @click="handleResume"
          >
            <i class="fas fa-play"></i>
          </button>
          <NuxtLink
            :to="`/monitors/${monitor.id}/edit`"
            class="btn btn-outline-secondary btn-sm"
            title="Edit"
          >
            <i class="fas fa-edit"></i>
          </NuxtLink>
          <button
            class="btn btn-outline-danger btn-sm"
            title="Delete"
            @click="handleDelete"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  monitor: any
  showActions?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showActions: false
})

const emit = defineEmits(['refresh'])

const latestHeartbeat = computed(() => props.monitor.heartbeats?.[0])

const statusColor = computed(() => {
  const status = latestHeartbeat.value?.status
  switch (status) {
    case 1: return 'bg-success'
    case 0: return 'bg-danger'
    case 2: return 'bg-warning'
    case 3: return 'bg-primary'
    default: return 'bg-secondary'
  }
})

const uptimePercentage = computed(() => {
  const heartbeats = props.monitor.heartbeats || []
  if (heartbeats.length === 0) return 0
  
  const upCount = heartbeats.filter((h: any) => h.status === 1).length
  return ((upCount / heartbeats.length) * 100).toFixed(1)
})

const uptimeColor = computed(() => {
  const uptime = parseFloat(uptimePercentage.value)
  if (uptime >= 99) return 'text-success'
  if (uptime >= 95) return 'text-warning'
  return 'text-danger'
})

const handlePause = async () => {
  await $fetch(`/api/v1/monitors/${props.monitor.id}/pause`, {
    method: 'POST'
  })
  emit('refresh')
}

const handleResume = async () => {
  await $fetch(`/api/v1/monitors/${props.monitor.id}/resume`, {
    method: 'POST'
  })
  emit('refresh')
}

const handleDelete = async () => {
  if (!confirm(`Are you sure you want to delete "${props.monitor.name}"?`)) {
    return
  }
  
  await $fetch(`/api/v1/monitors/${props.monitor.id}`, {
    method: 'DELETE'
  })
  emit('refresh')
}
</script>

<style scoped>
.monitor-card {
  padding: 12px 15px;
  border-bottom: 1px solid #dee2e6;
  transition: background-color 0.15s;
}

.monitor-card:hover {
  background: #f8f9fa;
}

.dark .monitor-card {
  border-color: #373d45;
}

.dark .monitor-card:hover {
  background: #2d3238;
}

.monitor-card:last-child {
  border-bottom: none;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.monitor-name {
  font-weight: 500;
  color: inherit;
  text-decoration: none;
}

.monitor-name:hover {
  color: #5cdd8b;
}

.monitor-meta {
  font-size: 0.875rem;
  color: #6c757d;
  margin-top: 2px;
}

.uptime-display {
  min-width: 60px;
  text-align: right;
  font-weight: 500;
}
</style>
