<template>
  <div class="monitor-selector">
    <label v-if="label" class="selector-label">{{ label }}</label>
    
    <!-- Selected Monitors -->
    <div v-if="modelValue.length > 0" class="selected-monitors">
      <div
        v-for="monitor in selectedMonitorDetails"
        :key="monitor.id"
        class="selected-tag"
      >
        <span class="tag-name">{{ monitor.name }}</span>
        <button class="tag-remove" @click="removeMonitor(monitor.id)">
          <UIcon name="i-heroicons-x-mark" />
        </button>
      </div>
    </div>

    <!-- Dropdown -->
    <div class="dropdown-wrapper" ref="dropdownRef">
      <div class="search-input-wrapper">
        <UIcon name="i-heroicons-magnifying-glass" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="placeholder"
          @focus="isOpen = true"
        />
      </div>

      <!-- Dropdown List -->
      <div v-if="isOpen && filteredMonitors.length > 0" class="dropdown-list">
        <div
          v-for="monitor in filteredMonitors"
          :key="monitor.id"
          class="dropdown-item"
          :class="{ disabled: isSelected(monitor.id) }"
          @click="addMonitor(monitor)"
        >
          <span class="monitor-name">{{ monitor.name }}</span>
          <span v-if="isSelected(monitor.id)" class="selected-check">
            <UIcon name="i-heroicons-check" />
          </span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="isOpen && searchQuery && filteredMonitors.length === 0" class="dropdown-empty">
        No monitors found
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'

interface Monitor {
  id: number
  name: string
  type?: string
  url?: string
}

const props = withDefaults(defineProps<{
  modelValue: number[]
  monitors: Monitor[]
  label?: string
  placeholder?: string
  multiple?: boolean
}>(), {
  label: '',
  placeholder: 'Search monitors...',
  multiple: true
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
}>()

const dropdownRef = ref<HTMLElement | null>(null)
const searchQuery = ref('')
const isOpen = ref(false)

// Close dropdown when clicking outside
onClickOutside(dropdownRef, () => {
  isOpen.value = false
})

// Computed
const filteredMonitors = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return props.monitors.filter(monitor => {
    const matchesSearch = !query || monitor.name.toLowerCase().includes(query)
    return matchesSearch
  })
})

const selectedMonitorDetails = computed(() => {
  return props.monitors.filter(m => props.modelValue.includes(m.id))
})

// Methods
function isSelected(id: number): boolean {
  return props.modelValue.includes(id)
}

function addMonitor(monitor: Monitor) {
  if (isSelected(monitor.id)) return
  
  if (props.multiple) {
    emit('update:modelValue', [...props.modelValue, monitor.id])
  } else {
    emit('update:modelValue', [monitor.id])
    isOpen.value = false
  }
  
  searchQuery.value = ''
}

function removeMonitor(id: number) {
  emit('update:modelValue', props.modelValue.filter(m => m !== id))
}
</script>

<style scoped>
.monitor-selector {
  width: 100%;
}

.selector-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--uk-text, #374151);
}

.selected-monitors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--uk-primary) 20%, transparent);
  color: var(--uk-primary-fg, #065f46);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.tag-remove:hover {
  opacity: 1;
}

.dropdown-wrapper {
  position: relative;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  color: var(--uk-text-muted, #6b7280);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  font-size: 0.875rem;
  border: 1px solid var(--uk-border, var(--uk-border));
  border-radius: 8px;
  background: var(--uk-bg-raised, #f9fafb);
  color: var(--uk-text, #374151);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary, #10b981);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--uk-primary) 20%, transparent));
}

.dropdown-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  background: var(--uk-bg-surface, white);
  border: 1px solid var(--uk-border, var(--uk-border));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover:not(.disabled) {
  background: var(--uk-bg-hover, #f3f4f6);
}

.dropdown-item.disabled {
  opacity: 0.6;
  cursor: default;
}

.monitor-name {
  font-size: 0.875rem;
  color: var(--uk-text, #374151);
}

.selected-check {
  color: var(--color-primary, #10b981);
}

.dropdown-empty {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  padding: 16px;
  text-align: center;
  font-size: 0.875rem;
  color: var(--uk-text-muted, #6b7280);
  background: var(--uk-bg-surface, white);
  border: 1px solid var(--uk-border, var(--uk-border));
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 50;
}

</style>
