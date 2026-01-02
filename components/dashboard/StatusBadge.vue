<template>
  <span class="status-badge" :class="statusClass">
    {{ statusText }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  status: number
}

const props = defineProps<Props>()

const statusClass = computed(() => {
  switch (props.status) {
    case 1: return 'up'
    case 0: return 'down'
    case 2: return 'pending'
    case 3: return 'maintenance'
    default: return 'unknown'
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 1: return 'Up'
    case 0: return 'Down'
    case 2: return 'Pending'
    case 3: return 'Maintenance'
    default: return 'Unknown'
  }
})
</script>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.status-badge.up {
  background: #28a745;
}

.status-badge.down {
  background: #dc3545;
}

.status-badge.pending {
  background: #ffc107;
  color: #212529;
}

.status-badge.maintenance {
  background: #1e90ff;
}

.status-badge.unknown {
  background: #6c757d;
}
</style>
