<template>
  <div class="monitor-item" :class="{ disabled: !monitor.active }">
    <!-- Checkbox for select mode -->
    <div v-if="selectMode" class="select-checkbox">
      <input 
        type="checkbox" 
        :checked="selected"
        @change="$emit('toggle-select')"
      />
    </div>

    <NuxtLink :to="`/monitors/${monitor.id}`" class="item-link">
      <div class="item-row">
        <!-- Name & Uptime -->
        <div class="item-info">
          <span class="uptime-badge" :class="uptimeClass">
            {{ uptimePercent }}%
          </span>
          <span class="monitor-name">{{ monitor.name }}</span>
          <div v-if="monitor.tags?.length" class="tags">
            <span 
              v-for="tag in monitor.tags" 
              :key="tag.id" 
              class="tag"
              :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>

        <!-- Heartbeat Bar -->
        <div class="heartbeat-section">
          <HeartbeatBarSimple :heartbeats="monitor.heartbeats?.slice(0, 50) || []" />
        </div>
      </div>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
interface Props {
  monitor: any
  selectMode?: boolean
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectMode: false,
  selected: false
})

defineEmits(['toggle-select'])

const heartbeats = computed(() => props.monitor.heartbeats || [])

const uptimePercent = computed(() => {
  if (heartbeats.value.length === 0) return '0.0'
  const up = heartbeats.value.filter((h: any) => h.status === 1).length
  return ((up / heartbeats.value.length) * 100).toFixed(1)
})

const uptimeClass = computed(() => {
  const uptime = parseFloat(uptimePercent.value)
  if (uptime >= 98) return 'bg-success'
  if (uptime >= 90) return 'bg-warning'
  return 'bg-danger'
})
</script>

<style scoped>
.monitor-item {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.15s;
}

.dark .monitor-item {
  border-color: #30363d;
}

.monitor-item:hover {
  background: rgba(0, 0, 0, 0.02);
}

.dark .monitor-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.monitor-item.disabled {
  opacity: 0.5;
}

.select-checkbox {
  padding-right: 8px;
}

.select-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.item-link {
  flex: 1;
  text-decoration: none;
  color: inherit;
}

.item-row {
  display: flex;
  align-items: center;
}

.item-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.uptime-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
  white-space: nowrap;
}

.bg-success { background: #28a745; }
.bg-warning { background: #ffc107; color: #212529; }
.bg-danger { background: #dc3545; }

.monitor-name {
  font-size: 0.875rem;
  color: #212529;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .monitor-name {
  color: #c9d1d9;
}

.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.65rem;
  color: white;
}

.heartbeat-section {
  flex-shrink: 0;
  width: 200px;
}

@media (max-width: 768px) {
  .heartbeat-section {
    display: none;
  }
}
</style>
