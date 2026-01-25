<template>
  <div class="public-group-list">
    <!-- Draggable wrapper for edit mode -->
    <Draggable
      v-if="editMode"
      :list="groups"
      item-key="id"
      :animation="100"
      handle=".group-drag-handle"
      @change="onGroupDragChange"
    >
      <template #item="{ element: group, index }">
        <div class="group-section mb-8">
          <GroupHeader
            :group="group"
            :index="index"
            :edit-mode="editMode"
            :show-drag="groups.length >= 2"
            @remove="emit('removeGroup', index)"
            @rename="(name) => emit('renameGroup', group, name)"
          />
          
          <div class="monitor-list-container shadow-box">
            <MonitorListContent
              :group="group"
              :index="index"
              :edit-mode="editMode"
              :show-tags="showTags"
              :show-certificate-expiry="showCertificateExpiry"
              @removeMonitor="(monitorIndex) => emit('removeMonitor', index, monitorIndex)"
              @monitorSettings="(monitor) => emit('monitorSettings', group, monitor)"
              @reorder="() => emit('reorderMonitors', group)"
            />
          </div>
        </div>
      </template>
    </Draggable>
    
    <!-- Static list for view mode -->
    <template v-else>
      <div
        v-for="(group, index) in filteredGroups"
        :key="group.id"
        class="group-section mb-8"
      >
        <!-- Group title (only show if multiple groups or specified) -->
        <h2 v-if="showGroupTitle" class="group-title">
          {{ group.name }}
        </h2>
        
        <div class="monitor-list-container shadow-box">
          <!-- Empty state -->
          <div v-if="getMonitorsForGroup(group).length === 0" class="empty-state">
            {{ $t('No Monitors') }}
          </div>
          
          <!-- Monitor cards -->
          <StatusMonitorCard
            v-for="monitor in getMonitorsForGroup(group)"
            :key="monitor.id"
            :monitor="monitor"
            :edit-mode="editMode"
            :show-tags="showTags"
            :show-certificate-expiry="showCertificateExpiry"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import Draggable from 'vuedraggable'

interface Tag {
  id?: number
  name: string
  color?: string
}

interface Heartbeat {
  status: number
  time: string
  ping?: number
  msg?: string
}

interface Monitor {
  id: number
  name: string
  url?: string
  sendUrl?: boolean
  type?: string
  uptime24?: number
  validCert?: boolean
  certExpiryDaysRemaining?: number
  tags?: Tag[]
  heartbeats?: Heartbeat[]
}

interface Group {
  id: number
  name: string
  weight?: number
  monitorList: Monitor[]
}

const props = withDefaults(defineProps<{
  groups: Group[]
  editMode?: boolean
  showTags?: boolean
  showCertificateExpiry?: boolean
  activeTab?: number | 'all' | null
  page?: number
  perPage?: number
  paginatedData?: Monitor[]
}>(), {
  editMode: false,
  showTags: false,
  showCertificateExpiry: false,
  activeTab: 'all',
  page: 1,
  perPage: 10
})

const emit = defineEmits<{
  (e: 'removeGroup', index: number): void
  (e: 'removeMonitor', groupIndex: number, monitorIndex: number): void
  (e: 'monitorSettings', group: Group, monitor: Monitor): void
  (e: 'update:groups', groups: Group[]): void
  (e: 'renameGroup', group: Group, name: string): void
  (e: 'reorderMonitors', group: Group): void
}>()

// Show group title logic
const showGroupTitle = computed(() => {
  // Always show in edit mode
  if (props.editMode) return true
  
  // Show when displaying all groups
  if (props.activeTab === 'all') return true
  
  // Hide when showing single group (tab already indicates which group)
  return false
})

// Filter groups based on active tab
const filteredGroups = computed(() => {
  if (props.editMode) {
    return props.groups
  }
  
  if (props.activeTab === 'all' || !props.activeTab) {
    return props.groups
  }
  
  // Filter to show only the selected group
  return props.groups.filter(group => group.id === props.activeTab)
})

// Get monitors for a group (with pagination support)
function getMonitorsForGroup(group: Group): Monitor[] {
  // In edit mode, show all monitors
  if (props.editMode) {
    return group.monitorList
  }
  
  // If paginated data is provided, use it
  if (props.paginatedData?.length) {
    // Filter monitors that belong to this group
    return props.paginatedData.filter(monitor => 
      group.monitorList.some(gm => gm.id === monitor.id)
    )
  }
  
  // Fallback to all monitors in the group
  return group.monitorList
}

// Handle drag events
function onGroupDragChange(event: any) {
  if (event.moved) {
    const newGroups = [...props.groups]
    const [removed] = newGroups.splice(event.moved.oldIndex, 1)
    newGroups.splice(event.moved.newIndex, 0, removed)
    emit('update:groups', newGroups)
  }
}
</script>

<script lang="ts">
// Re-define types for sub-components (TypeScript needs this in separate script block)
interface Group {
  id: number
  name: string
  weight?: number
  monitorList: any[]
}

// Sub-components
const GroupHeader = defineComponent({
  props: {
    group: { type: Object as PropType<Group>, required: true },
    index: { type: Number, required: true },
    editMode: { type: Boolean, default: false },
    showDrag: { type: Boolean, default: false }
  },
  emits: ['remove', 'rename'],
  setup(props, { emit }) {
    const nameInput = ref(props.group.name)

    watch(() => props.group.name, (val) => { nameInput.value = val })

    const commitName = () => {
      if (nameInput.value !== props.group.name) {
        emit('rename', nameInput.value.trim() || 'New Group')
      }
    }

    return () => h('div', { class: 'group-title' }, [
      props.editMode && props.showDrag && h(resolveComponent('UIcon'), {
        name: 'i-heroicons-bars-3',
        class: 'group-drag-handle text-gray-400 cursor-grab mr-3'
      }),
      props.editMode && h(resolveComponent('UButton'), {
        icon: 'i-heroicons-x-mark',
        size: 'xs',
        color: 'red',
        variant: 'ghost',
        class: 'mr-3',
        onClick: () => emit('remove')
      }),
      props.editMode
        ? h('input', {
            class: 'group-name-input',
            value: nameInput.value,
            onInput: (e: any) => { nameInput.value = e.target.value },
            onBlur: commitName,
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitName()
              }
            }
          })
        : h('span', props.group.name)
    ])
  }
})

const MonitorListContent = defineComponent({
  props: {
    group: { type: Object as PropType<Group>, required: true },
    index: { type: Number, required: true },
    editMode: { type: Boolean, default: false },
    showTags: { type: Boolean, default: false },
    showCertificateExpiry: { type: Boolean, default: false }
  },
  emits: ['removeMonitor', 'monitorSettings', 'reorder'],
  setup(props, { emit }) {
    return () => {
      if (!props.group.monitorList?.length) {
        return h('div', { class: 'empty-state text-center py-4 text-gray-500' }, 'No Monitors')
      }
      
      return h(resolveComponent('Draggable'), {
        list: props.group.monitorList,
        itemKey: 'id',
        animation: 100,
        disabled: !props.editMode,
        group: 'monitors',
        onChange: () => emit('reorder')
      }, {
        item: ({ element: monitor, index: monitorIndex }: any) => 
          h(resolveComponent('StatusMonitorCard'), {
            key: monitor.id,
            monitor,
            editMode: props.editMode,
            showTags: props.showTags,
            showCertificateExpiry: props.showCertificateExpiry,
            onRemove: () => emit('removeMonitor', monitorIndex),
            onSettings: () => emit('monitorSettings', monitor)
          })
      })
    }
  }
})
</script>

<style scoped>
.public-group-list {
  width: 100%;
}

.group-section {
  margin-bottom: 2rem;
}

.group-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  color: #0f172a;
}

.dark .group-title {
  color: #f1f5f9;
}

.monitor-list-container {
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  min-height: 46px;
  border: 1px solid #d6deea;
}

.dark .monitor-list-container {
  background: #161b22;
  border-color: #1d2634;
}

.shadow-box {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
}

.dark .shadow-box {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #64748b;
}

.dark .empty-state {
  color: #9ca3af;
}

.group-drag-handle {
  cursor: grab;
}

.group-drag-handle:active {
  cursor: grabbing;
}

.group-name-input {
  border: 1px solid rgba(148, 163, 184, 0.6);
  border-radius: 6px;
  padding: 4px 8px;
  min-width: 160px;
  background: transparent;
  color: inherit;
}

.group-name-input:focus {
  outline: 2px solid #22c55e;
  border-color: transparent;
}
</style>
