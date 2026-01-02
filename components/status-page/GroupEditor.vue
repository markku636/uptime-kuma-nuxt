<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">Status Page Groups</h3>
      <UButton 
        icon="i-heroicons-plus" 
        size="sm"
        @click="addGroup"
      >
        Add Group
      </UButton>
    </div>

    <!-- Groups List -->
    <div 
      class="space-y-4"
      @dragover.prevent
      @drop="handleDrop"
    >
      <div
        v-for="(group, groupIndex) in localGroups"
        :key="group.id || groupIndex"
        class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        draggable="true"
        @dragstart="handleGroupDragStart(groupIndex)"
        @dragend="handleDragEnd"
      >
        <!-- Group Header -->
        <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800">
          <UIcon name="i-heroicons-bars-3" class="cursor-move text-gray-400" />
          
          <UInput 
            v-model="group.name" 
            placeholder="Group name"
            class="flex-1"
            @blur="emitUpdate"
          />
          
          <UButton 
            icon="i-heroicons-trash" 
            variant="ghost" 
            color="red"
            size="sm"
            @click="removeGroup(groupIndex)"
          />
        </div>

        <!-- Monitors in Group -->
        <div 
          class="p-3 min-h-[60px]"
          @dragover.prevent="handleMonitorDragOver($event, groupIndex)"
          @drop="handleMonitorDrop(groupIndex)"
        >
          <div v-if="group.monitorList && group.monitorList.length > 0" class="space-y-2">
            <div
              v-for="(monitorId, monitorIndex) in group.monitorList"
              :key="monitorId"
              class="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700 rounded"
              draggable="true"
              @dragstart="handleMonitorDragStart(groupIndex, monitorIndex)"
            >
              <UIcon name="i-heroicons-bars-2" class="cursor-move text-gray-400" />
              <span>{{ getMonitorName(monitorId) }}</span>
              <UButton 
                icon="i-heroicons-x-mark" 
                variant="ghost" 
                size="xs"
                class="ml-auto"
                @click="removeMonitor(groupIndex, monitorIndex)"
              />
            </div>
          </div>
          <div v-else class="text-center text-gray-400 py-2">
            Drag monitors here
          </div>
        </div>

        <!-- Add Monitor -->
        <div class="p-3 border-t border-gray-200 dark:border-gray-700">
          <USelectMenu
            :model-value="null"
            :items="availableMonitors(groupIndex)"
            value-key="id"
            label-key="name"
            placeholder="Add monitor..."
            @update:model-value="(monitor) => addMonitorToGroup(groupIndex, monitor)"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="localGroups.length === 0" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-squares-2x2" class="w-12 h-12 mx-auto mb-3" />
      <p>No groups yet</p>
      <p class="text-sm">Click "Add Group" to create your first group</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Monitor {
  id: number
  name: string
}

interface Group {
  id?: number
  name: string
  weight?: number
  monitorList: number[]
}

interface Props {
  modelValue: Group[]
  monitors: Monitor[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [groups: Group[]]
}>()

const localGroups = ref<Group[]>([])

// Sync local state with props
watch(() => props.modelValue, (newVal) => {
  localGroups.value = JSON.parse(JSON.stringify(newVal || []))
}, { immediate: true, deep: true })

// Drag state
const dragState = reactive({
  type: '' as 'group' | 'monitor' | '',
  fromGroupIndex: -1,
  fromMonitorIndex: -1
})

function emitUpdate() {
  emit('update:modelValue', JSON.parse(JSON.stringify(localGroups.value)))
}

function addGroup() {
  localGroups.value.push({
    name: `Group ${localGroups.value.length + 1}`,
    weight: localGroups.value.length,
    monitorList: []
  })
  emitUpdate()
}

function removeGroup(index: number) {
  localGroups.value.splice(index, 1)
  emitUpdate()
}

function getMonitorName(monitorId: number): string {
  const monitor = props.monitors.find(m => m.id === monitorId)
  return monitor?.name || `Monitor #${monitorId}`
}

function availableMonitors(groupIndex: number): Monitor[] {
  // Get all monitors already in any group
  const usedIds = new Set<number>()
  localGroups.value.forEach(group => {
    group.monitorList?.forEach(id => usedIds.add(id))
  })

  return props.monitors.filter(m => !usedIds.has(m.id))
}

function addMonitorToGroup(groupIndex: number, monitor: Monitor | null) {
  if (!monitor) return
  
  if (!localGroups.value[groupIndex].monitorList) {
    localGroups.value[groupIndex].monitorList = []
  }
  
  localGroups.value[groupIndex].monitorList.push(monitor.id)
  emitUpdate()
}

function removeMonitor(groupIndex: number, monitorIndex: number) {
  localGroups.value[groupIndex].monitorList.splice(monitorIndex, 1)
  emitUpdate()
}

// Drag handlers
function handleGroupDragStart(groupIndex: number) {
  dragState.type = 'group'
  dragState.fromGroupIndex = groupIndex
}

function handleMonitorDragStart(groupIndex: number, monitorIndex: number) {
  dragState.type = 'monitor'
  dragState.fromGroupIndex = groupIndex
  dragState.fromMonitorIndex = monitorIndex
}

function handleDragEnd() {
  dragState.type = ''
  dragState.fromGroupIndex = -1
  dragState.fromMonitorIndex = -1
}

function handleDrop(event: DragEvent) {
  if (dragState.type === 'group') {
    // Reorder groups - handled by drag over target
  }
  handleDragEnd()
}

function handleMonitorDragOver(event: DragEvent, groupIndex: number) {
  event.preventDefault()
}

function handleMonitorDrop(targetGroupIndex: number) {
  if (dragState.type === 'monitor' && dragState.fromGroupIndex !== -1) {
    const monitorId = localGroups.value[dragState.fromGroupIndex].monitorList[dragState.fromMonitorIndex]
    
    // Remove from old group
    localGroups.value[dragState.fromGroupIndex].monitorList.splice(dragState.fromMonitorIndex, 1)
    
    // Add to new group
    if (!localGroups.value[targetGroupIndex].monitorList) {
      localGroups.value[targetGroupIndex].monitorList = []
    }
    localGroups.value[targetGroupIndex].monitorList.push(monitorId)
    
    emitUpdate()
  }
  handleDragEnd()
}
</script>
