<template>
  <div class="public-group-list">
    <!-- Draggable wrapper for edit mode -->
    <Draggable
      v-if="editMode"
      v-model="localGroups"
      item-key="id"
      :animation="100"
      handle=".group-drag-handle"
    >
      <template #item="{ element: group, index }">
        <div class="group-section mb-8">
          <!-- Group Header -->
          <div class="group-title">
            <UIcon
              v-if="localGroups.length >= 2"
              name="i-heroicons-bars-3"
              class="group-drag-handle text-gray-400 cursor-grab mr-3"
            />
            <UButton
              icon="i-heroicons-x-mark"
              size="xs"
              color="error"
              variant="ghost"
              class="mr-3"
              @click="emit('removeGroup', index)"
            />
            <input
              :value="group.name"
              class="group-name-input"
              @input="(e) => group.name = (e.target as HTMLInputElement).value"
              @blur="emit('renameGroup', group, group.name)"
              @keydown.enter="emit('renameGroup', group, group.name)"
            />
          </div>
          
          <div class="monitor-list-container shadow-box">
            <!-- Empty state for this group -->
            <div v-if="!group.monitorList?.length" class="empty-state text-center py-4 text-gray-500">
              No Monitors
            </div>
            
            <!-- Monitor List with Draggable -->
            <Draggable
              v-else
              :list="group.monitorList"
              item-key="id"
              :animation="100"
              group="monitors"
              @change="emit('reorderMonitors', group)"
            >
              <template #item="{ element: monitor, index: monitorIndex }">
                <StatusMonitorCard
                  :key="monitor.id"
                  :monitor="monitor"
                  :edit-mode="true"
                  :show-tags="showTags"
                  :show-certificate-expiry="showCertificateExpiry"
                  @remove="emit('removeMonitor', index, monitorIndex)"
                  @settings="emit('monitorSettings', group, monitor)"
                  @update:sendUrl="(value: boolean) => { monitor.sendUrl = value; emit('monitorSettings', group, monitor) }"
                />
              </template>
            </Draggable>
          </div>
        </div>
      </template>
    </Draggable>
    
    <!-- Static list for view mode -->
    <template v-else>
      <div
        v-for="(group, gIndex) in filteredGroups"
        :key="group.id"
        class="group-section mb-8"
      >
        <!-- Group title (only show if multiple groups or specified) -->
        <h2 v-if="showGroupTitle" class="group-title">
          <button
            type="button"
            class="group-collapse"
            :aria-expanded="!isGroupCollapsed(group.id)"
            :aria-label="isGroupCollapsed(group.id) ? `Expand ${group.name}` : `Collapse ${group.name}`"
            @click="toggleGroup(group.id)"
          >
            <UIcon :name="isGroupCollapsed(group.id) ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-4 h-4" />
          </button>
          {{ group.name }}
          <span class="group-count">{{ getMonitorsForGroup(group).length }}</span>
        </h2>

        <div v-show="!isGroupCollapsed(group.id)" class="monitor-list-container shadow-box">
          <!-- Empty state -->
          <div v-if="getMonitorsForGroup(group).length === 0" class="empty-state">
            {{ $t('No Monitors') }}
          </div>
          
          <!-- Monitor cards -->
          <StatusMonitorCard
            v-for="monitor in getMonitorsForGroup(group)"
            :key="monitor.id"
            :monitor="monitor"
            :edit-mode="false"
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

// Viewers can collapse long groups; state is local and never persisted server-side.
const collapsedGroups = ref<Set<number>>(new Set())
function isGroupCollapsed(id: number) { return collapsedGroups.value.has(id) }
function toggleGroup(id: number) {
  const next = new Set(collapsedGroups.value)
  if (next.has(id)) next.delete(id); else next.add(id)
  collapsedGroups.value = next
}

// Show group title logic
const showGroupTitle = computed(() => {
  // Always show in edit mode
  if (props.editMode) return true
  
  // Show when displaying all groups
  if (props.activeTab === 'all') return true
  
  // Hide when showing single group (tab already indicates which group)
  return false
})

// Local groups with v-model pattern for Draggable
const localGroups = computed({
  get: () => props.groups,
  set: (value) => emit('update:groups', value)
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

.group-collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: 6px;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  border: none;
  cursor: pointer;
}
.group-collapse:hover { background: rgba(127,127,127,.15); }
.group-count { margin-left: 8px; font-size: .8rem; opacity: .6; }

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
