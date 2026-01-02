<template>
  <div class="monitor-group-list space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-medium">{{ $t('Monitor Groups') }}</h3>
      <UButton size="sm" @click="$emit('addGroup')">
        <UIcon name="i-heroicons-plus" class="mr-1" />
        {{ $t('Add Group') }}
      </UButton>
    </div>

    <!-- Empty State -->
    <div v-if="!groups.length" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-folder" class="w-12 h-12 mx-auto mb-2" />
      <p>{{ $t('No groups yet') }}</p>
      <p class="text-sm">{{ $t('Create groups to organize your monitors') }}</p>
    </div>

    <!-- Ungrouped Monitors -->
    <div v-if="ungroupedMonitors.length" class="mb-6">
      <div class="flex items-center gap-2 mb-2 text-gray-500">
        <UIcon name="i-heroicons-inbox" class="w-4 h-4" />
        <span class="text-sm font-medium">{{ $t('Ungrouped') }}</span>
        <UBadge variant="subtle" size="xs">{{ ungroupedMonitors.length }}</UBadge>
      </div>
      
      <div class="grid grid-cols-1 gap-2 ml-6">
        <div
          v-for="monitor in ungroupedMonitors"
          :key="monitor.id"
          class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
          draggable="true"
          @dragstart="onDragStart($event, monitor)"
        >
          <div class="flex items-center gap-2">
            <Status :status="getMonitorStatus(monitor)" size="xs" />
            <span class="text-sm">{{ monitor.name }}</span>
          </div>
          <UIcon name="i-heroicons-bars-2" class="w-4 h-4 text-gray-400 cursor-grab" />
        </div>
      </div>
    </div>

    <!-- Groups -->
    <div
      v-for="group in groups"
      :key="group.id"
      class="group-item border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      @dragover.prevent
      @drop="onDrop($event, group.id)"
    >
      <!-- Group Header -->
      <div 
        class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 cursor-pointer"
        @click="toggleGroup(group.id)"
      >
        <div class="flex items-center gap-2">
          <UIcon 
            name="i-heroicons-chevron-right" 
            class="w-4 h-4 transition-transform"
            :class="{ 'rotate-90': expandedGroups.has(group.id) }"
          />
          <span class="font-medium">{{ group.name }}</span>
          <UBadge variant="subtle" size="xs">{{ group.monitors.length }}</UBadge>
          
          <!-- Group Status -->
          <div class="flex items-center gap-1 ml-2">
            <span 
              v-if="getGroupUpCount(group) > 0"
              class="text-xs text-green-500"
            >
              {{ getGroupUpCount(group) }} up
            </span>
            <span 
              v-if="getGroupDownCount(group) > 0"
              class="text-xs text-red-500"
            >
              {{ getGroupDownCount(group) }} down
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2" @click.stop>
          <UButton 
            variant="ghost" 
            size="xs" 
            icon="i-heroicons-pencil"
            @click="$emit('editGroup', group.id)"
          />
          <UButton 
            variant="ghost" 
            size="xs" 
            icon="i-heroicons-trash"
            color="error"
            @click="$emit('deleteGroup', group.id)"
          />
        </div>
      </div>

      <!-- Group Monitors -->
      <Transition
        enter-active-class="transition-all duration-200"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0 max-h-0"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="expandedGroups.has(group.id)" class="p-2">
          <div v-if="!group.monitors.length" class="text-center py-4 text-gray-500 text-sm">
            {{ $t('Drag monitors here') }}
          </div>
          
          <div
            v-for="monitor in group.monitors"
            :key="monitor.id"
            class="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
            draggable="true"
            @dragstart="onDragStart($event, monitor)"
          >
            <div class="flex items-center gap-2">
              <Status :status="getMonitorStatus(monitor)" size="xs" />
              <span class="text-sm">{{ monitor.name }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="monitor.ping" class="text-xs text-gray-500 font-mono">
                {{ monitor.ping }}ms
              </span>
              <UButton
                variant="ghost"
                size="xs"
                icon="i-heroicons-x-mark"
                @click="$emit('removeFromGroup', group.id, monitor.id)"
              />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Monitor {
  id: number
  name: string
  status?: number
  ping?: number
  groupId?: number | null
}

interface MonitorGroup {
  id: number
  name: string
  monitors: Monitor[]
}

const props = defineProps<{
  groups: MonitorGroup[]
  ungroupedMonitors: Monitor[]
}>()

const emit = defineEmits<{
  (e: 'addGroup'): void
  (e: 'editGroup', groupId: number): void
  (e: 'deleteGroup', groupId: number): void
  (e: 'addToGroup', groupId: number, monitorId: number): void
  (e: 'removeFromGroup', groupId: number, monitorId: number): void
}>()

const expandedGroups = ref(new Set<number>())
let draggedMonitor: Monitor | null = null

function toggleGroup(groupId: number) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

function getMonitorStatus(monitor: Monitor): string {
  switch (monitor.status) {
    case 1: return 'up'
    case 0: return 'down'
    case 3: return 'maintenance'
    default: return 'pending'
  }
}

function getGroupUpCount(group: MonitorGroup): number {
  return group.monitors.filter(m => m.status === 1).length
}

function getGroupDownCount(group: MonitorGroup): number {
  return group.monitors.filter(m => m.status === 0).length
}

function onDragStart(event: DragEvent, monitor: Monitor) {
  draggedMonitor = monitor
  event.dataTransfer?.setData('text/plain', monitor.id.toString())
}

function onDrop(event: DragEvent, groupId: number) {
  event.preventDefault()
  if (draggedMonitor) {
    emit('addToGroup', groupId, draggedMonitor.id)
    draggedMonitor = null
  }
}

// Expand all groups initially
onMounted(() => {
  props.groups.forEach(g => expandedGroups.value.add(g.id))
})
</script>
