<template>
  <div class="monitor-list-panel shadow-box">
    <!-- Header -->
    <div class="list-header">
      <div class="header-top">
        <button 
          class="btn btn-outline" 
          :class="{ active: selectMode }" 
          @click="selectMode = !selectMode"
        >
          Select
        </button>
        
        <div class="search-wrapper">
          <UIcon name="i-heroicons-magnifying-glass" class="search-icon" />
          <input
            v-model="searchText"
            class="search-input"
            placeholder="Search..."
          />
          <button v-if="searchText" class="clear-btn" @click="searchText = ''">
            <UIcon name="i-heroicons-x-mark" />
          </button>
        </div>
      </div>

      <!-- Selection Controls -->
      <div v-if="selectMode" class="selection-controls">
        <input 
          v-model="selectAll" 
          type="checkbox" 
          class="form-check-input"
        />
        <button class="btn btn-outline btn-sm" @click="pauseSelected">
          <UIcon name="i-heroicons-pause" /> Pause
        </button>
        <button class="btn btn-outline btn-sm" @click="resumeSelected">
          <UIcon name="i-heroicons-play" /> Resume
        </button>
        <span v-if="selectedCount > 0" class="selected-count">
          {{ selectedCount }} selected
        </span>
      </div>
    </div>

    <!-- Monitor List -->
    <div class="monitor-list" :class="{ scrollbar: true }">
      <div v-if="filteredMonitors.length === 0" class="empty-state">
        No Monitors, please <NuxtLink to="/monitors/add">add one</NuxtLink>
      </div>

      <MonitorListItemSimple
        v-for="monitor in filteredMonitors"
        :key="monitor.id"
        :monitor="monitor"
        :select-mode="selectMode"
        :selected="selectedMonitors[monitor.id] || false"
        @toggle-select="toggleSelect(monitor.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  monitors: any[]
}

const props = defineProps<Props>()
const emit = defineEmits(['refresh'])

const searchText = ref('')
const selectMode = ref(false)
const selectedMonitors = ref<Record<number, boolean>>({})

const filteredMonitors = computed(() => {
  if (!searchText.value) return props.monitors
  
  const search = searchText.value.toLowerCase()
  return props.monitors.filter(m => 
    m.name.toLowerCase().includes(search) ||
    m.url?.toLowerCase().includes(search) ||
    m.hostname?.toLowerCase().includes(search)
  )
})

const selectedCount = computed(() => 
  Object.values(selectedMonitors.value).filter(Boolean).length
)

const selectAll = computed({
  get: () => {
    const monitors = filteredMonitors.value
    if (monitors.length === 0) return false
    return monitors.every(m => selectedMonitors.value[m.id])
  },
  set: (val: boolean) => {
    filteredMonitors.value.forEach(m => {
      selectedMonitors.value[m.id] = val
    })
  }
})

const toggleSelect = (id: number) => {
  selectedMonitors.value[id] = !selectedMonitors.value[id]
}

const pauseSelected = async () => {
  const ids = Object.entries(selectedMonitors.value)
    .filter(([_, selected]) => selected)
    .map(([id]) => Number(id))
  
  for (const id of ids) {
    await $fetch(`/api/v1/monitors/${id}/pause`, { method: 'POST' })
  }
  emit('refresh')
}

const resumeSelected = async () => {
  const ids = Object.entries(selectedMonitors.value)
    .filter(([_, selected]) => selected)
    .map(([id]) => Number(id))
  
  for (const id of ids) {
    await $fetch(`/api/v1/monitors/${id}/resume`, { method: 'POST' })
  }
  emit('refresh')
}
</script>

<style scoped>
.monitor-list-panel {
  height: calc(100vh - 160px);
  display: flex;
  flex-direction: column;
}

.shadow-box {
  background: white;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.list-header {
  padding: 12px;
  border-bottom: 1px solid var(--uk-border);
}

.header-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--uk-border);
  color: var(--uk-text);
}

.btn-outline:hover,
.btn-outline.active {
  background: rgba(0, 0, 0, 0.05);
}

.btn-sm {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.search-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--uk-text-muted);
  width: 16px;
  height: 16px;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 32px;
  border: 1px solid var(--uk-border);
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  color: var(--uk-text);
}

.search-input:focus {
  outline: none;
  border-color: var(--uk-status-up);
}

.clear-btn {
  position: absolute;
  right: 8px;
  background: transparent;
  border: none;
  color: var(--uk-text-muted);
  cursor: pointer;
  padding: 4px;
}

.selection-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--uk-border);
}

.form-check-input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.selected-count {
  font-size: 0.875rem;
  color: var(--uk-text-muted);
}

.monitor-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.scrollbar::-webkit-scrollbar {
  width: 8px;
}

.scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar::-webkit-scrollbar-thumb {
  background: var(--uk-border-strong);
  border-radius: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--uk-text-muted);
}

.empty-state a {
  color: var(--uk-status-up-fg);
  text-decoration: none;
}
</style>
