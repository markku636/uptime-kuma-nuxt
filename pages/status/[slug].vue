<script setup lang="ts">
/**
 * Public Status Page - Nuxt.js Implementation
 * Migrated from Vue+Node StatusPage.vue (2338 lines)
 * 
 * Features:
 * - Real-time WebSocket updates
 * - Edit mode with sidebar
 * - Draggable groups and monitors
 * - Pagination support
 * - Incident management
 * - Maintenance display
 * - Custom CSS support
 * - Theme switching (auto/light/dark)
 */

// Explicit import for useUserSession to ensure it's available
import { useUserSession } from '#imports'

// Public status page - no auth required for viewing
definePageMeta({
  layout: false
})

const route = useRoute()
const router = useRouter()
const slug = computed(() => route.params.slug as string)

// Use the composable for all status page functionality
const {
  // State
  config: statusPage,
  groups: publicGroupList,
  groupTabs,
  incident,
  maintenanceList,
  lastUpdateTime: lastUpdated,
  updateCountdownText: countdown,
  pagination,
  page,
  
  // UI State
  loading,
  error,
  
  // Computed
  overallStatus,
  overallStatusType,
  
  // Methods
  init,
  loadData,
  loadHeartbeat,
  changePage,
  
  // Edit Mode State
  editMode,
  saving,
  unsavedChanges,
  draftConfig,
  draftGroups,
  
  // Edit Mode Methods
  enableEditMode,
  disableEditMode,
  updateDraftConfig,
  saveStatusPage: saveStatusPageApi,
  deleteStatusPage,
  postIncident,
  unpinIncident,
  addGroup,
  removeGroup,
  updateGroupName,
  addMonitorToGroup,
  removeMonitorFromGroup,
  uploadLogo
} = usePublicStatusPage(slug)

// Other state
const showEditSidebar = ref(false)
const showDeleteConfirm = ref(false)

// Active group tab - use group ID instead of index for proper API calls
const activeGroupId = ref<number | null>(null)

// Source of groups (draft when editing, public when viewing)
const groupSource = computed(() => editMode.value ? draftGroups.value : publicGroupList.value)

// Active group index (derived from activeGroupId for UI purposes)
const activeGroupIndex = computed(() => {
  if (!activeGroupId.value || publicGroupList.value.length === 0) return 0
  const index = publicGroupList.value.findIndex(g => g.id === activeGroupId.value)
  return index >= 0 ? index : 0
})

// Monitor selection state for edit mode
const allMonitors = ref<any[]>([])
const selectedGroupForMonitor = ref<number | null>(null)
const selectedMonitorToAdd = ref<{ label: string; value: number; tags?: any[] } | null>(null)

// Check if user has edit permission
// useUserSession must be called at setup top-level (not in onMounted)
const { loggedIn } = useUserSession()
const canEdit = computed(() => loggedIn.value)

// Computed for backwards compatibility
const incidents = computed(() => incident.value ? [incident.value] : [])
const connected = ref(true)
const hasLoaded = computed(() => !loading.value)

// Markdown rendering for description and footer
const { renderMarkdown } = useMarkdown()

// A status page can force light or dark regardless of the visitor's preference.
// Toggle the class directly (instead of colorMode.preference) so the admin's
// saved preference is left untouched.
const colorMode = useColorMode()
function applyStatusPageTheme() {
  if (!import.meta.client) return
  const theme = statusPage.value?.theme
  const dark = theme === 'dark' || (theme !== 'light' && colorMode.value === 'dark')
  document.documentElement.classList.toggle('dark', dark)
}
watch(() => [statusPage.value?.theme, colorMode.value], applyStatusPageTheme)
onMounted(applyStatusPageTheme)
onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.classList.toggle('dark', colorMode.value === 'dark')
})
const descriptionHtml = computed(() => renderMarkdown(statusPage.value?.description))
const footerHtml = computed(() => renderMarkdown(statusPage.value?.footerText))

// Logo URL - use draft in edit mode, otherwise use original
const currentLogoUrl = computed({
  get: () => editMode.value ? (draftConfig.value?.icon ?? statusPage.value?.icon) : statusPage.value?.icon,
  set: (val: string | undefined) => {
    if (editMode.value && draftConfig.value) {
      draftConfig.value.icon = val
    }
  }
})

// Available monitors (not already in any group)
const availableMonitors = computed(() => {
  const usedMonitorIds = new Set<number>()
  for (const group of displayedGroups.value) {
    for (const monitor of group.monitorList || []) {
      usedMonitorIds.add(monitor.id)
    }
  }
  return allMonitors.value.filter(m => !usedMonitorIds.has(m.id))
})

// Available monitor options for USelectMenu (with label/value format)
const availableMonitorOptions = computed(() => {
  return availableMonitors.value.map(m => ({
    label: m.pathName || m.name,
    value: m.id,
    tags: m.tags || []
  }))
})

// Page head management
useHead({
  title: computed(() => statusPage.value?.title ? `${statusPage.value.title} - Status` : 'Status'),
})

// Initialize on mount
onMounted(async () => {
  await init()
  // Set initial active group after loading (use groupTabs which always has all groups)
  if (groupTabs.value.length > 0 && !activeGroupId.value) {
    activeGroupId.value = groupTabs.value[0].id
  }
  // Apply custom CSS if present
  applyCustomCss()
})

// Cleanup on unmount
onUnmounted(() => {
  removeCustomCss()
})

// Watch for custom CSS changes
watch(() => statusPage.value?.customCSS, () => {
  applyCustomCss()
})

// Custom CSS management
function applyCustomCss() {
  removeCustomCss()
  if (statusPage.value?.customCSS) {
    const styleEl = document.createElement('style')
    styleEl.textContent = statusPage.value.customCSS
    styleEl.id = 'custom-status-page-css'
    document.head.appendChild(styleEl)
  }
}

function removeCustomCss() {
  const styleEl = document.getElementById('custom-status-page-css')
  if (styleEl) {
    styleEl.remove()
  }
}

// Calculate overall status from all monitors
const { t } = useI18n()
const overallStatusConfig = computed(() => {
  // Light fills (up / pending) take dark text; dark fills take white
  switch (overallStatusType.value) {
    case 'operational':
      return { text: t('All Systems Operational'), icon: '✓', bgClass: 'bg-up', textClass: 'text-on-primary' }
    case 'partial-outage':
      return { text: t('Partially Degraded Service'), icon: '⚠', bgClass: 'bg-pending', textClass: 'text-on-primary' }
    case 'major-outage':
      return { text: t('Degraded Service'), icon: '✕', bgClass: 'bg-down', textClass: 'text-white' }
    case 'maintenance':
      return { text: t('Maintenance'), icon: '🔧', bgClass: 'bg-maintenance', textClass: 'text-white' }
    default:
      return { text: t('Unknown'), icon: '?', bgClass: 'bg-unknown', textClass: 'text-on-primary' }
  }
})

// Active group (for tab navigation) - uses activeGroupId
const activeGroup = computed(() => {
  if (groupSource.value.length === 0) return null
  if (!activeGroupId.value) return groupSource.value[0]
  return groupSource.value.find(g => g.id === activeGroupId.value) || groupSource.value[0]
})

// Show all groups or just active group based on layout
const showAllGroups = computed(() => {
  // In edit mode always show all groups to match legacy UX
  if (editMode.value) return true
  // Show all if only one group, otherwise use tabs
  return groupTabs.value.length <= 1
})

// Displayed groups - when tabs are used, API returns only the active group
const displayedGroups = computed(() => {
  if (showAllGroups.value) return groupSource.value
  // With pagination, API returns only the active group in groups
  // So we can just return groupSource.value directly (which is already filtered by API)
  return groupSource.value
})

// Visible page numbers for pagination (shows current page and nearby pages)
const visiblePageNumbers = computed(() => {
  if (!pagination.value) return []
  
  const totalPages = pagination.value.totalPages
  const currentPage = pagination.value.currentPage
  const maxVisible = 5 // Maximum number of page buttons to show
  
  if (totalPages <= maxVisible) {
    // Show all pages if total is small
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  
  const pages: (number | string)[] = []
  const halfVisible = Math.floor(maxVisible / 2)
  
  let startPage = Math.max(1, currentPage - halfVisible)
  let endPage = Math.min(totalPages, currentPage + halfVisible)
  
  // Adjust if we're near the start or end
  if (currentPage <= halfVisible) {
    endPage = maxVisible
  } else if (currentPage > totalPages - halfVisible) {
    startPage = totalPages - maxVisible + 1
  }
  
  // Add first page and ellipsis if needed
  if (startPage > 1) {
    pages.push(1)
    if (startPage > 2) {
      pages.push('...')
    }
  }
  
  // Add visible pages
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }
  
  // Add ellipsis and last page if needed
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push('...')
    }
    pages.push(totalPages)
  }
  
  return pages
})

// Edit mode handlers
async function toggleEditMode() {
  if (!editMode.value) {
    // Load full, unpaginated data before entering edit mode so all groups/monitors are available
    await loadData({ noPagination: true })

    enableEditMode()

    // Don't auto-create group - user should click "Add Group" button
    showEditSidebar.value = true

    // Ensure monitor options are ready and a default group is selected
    if (allMonitors.value.length === 0) {
      await loadAllMonitors()
    }
    if (draftGroups.value.length > 0) {
      selectedGroupForMonitor.value = draftGroups.value[0].id
    }
  } else {
    // Just hide sidebar when switching to view mode, keep edit mode active
    showEditSidebar.value = !showEditSidebar.value
  }
}

function exitEditMode() {
  if (unsavedChanges.value) {
    // Prompt to save or discard
    if (confirm('You have unsaved changes. Discard them?')) {
      disableEditMode()
      showEditSidebar.value = false
      // Reload data with pagination
      loadData()
    }
  } else {
    disableEditMode()
    showEditSidebar.value = false
  }
}

async function saveStatusPage(config?: any) {
  if (!canEdit.value) return
  
  // If config is passed from sidebar, update draft first
  if (config) {
    updateDraftConfig(config)
  }
  
  const result = await saveStatusPageApi()
  if (result.success) {
    console.log('Status page saved successfully')
    // Exit edit mode and close sidebar after successful save
    disableEditMode()
    showEditSidebar.value = false
    // Reload data with pagination (show first group)
    activeGroupId.value = null
    await loadData()
    // Set activeGroupId to first group after reload
    if (groupTabs.value.length > 0) {
      activeGroupId.value = groupTabs.value[0].id
    }
  } else {
    console.error('Failed to save status page:', result.error)
    alert('Failed to save: ' + (result.error || 'Unknown error'))
  }
}

async function handleDelete() {
  const result = await deleteStatusPage()
  if (result.success) {
    router.push('/status-pages')
  } else {
    console.error('Failed to delete status page:', result.error)
  }
}

// Incident handlers
async function handleIncidentPost(incidentData: any) {
  const result = await postIncident(incidentData)
  if (!result.success) {
    console.error('Failed to post incident:', result.error)
  }
}

async function handleUnpinIncident() {
  const result = await unpinIncident()
  if (!result.success) {
    console.error('Failed to unpin incident:', result.error)
  }
}

// Group handlers
function handleGroupUpdate(groups: any[]) {
  // Update group order in draft
  if (editMode.value) {
    reorderGroups(groups)
  }
}

// Add group handler
function handleAddGroup() {
  addGroup()
  // Auto-select the new group
  if (draftGroups.value.length > 0) {
    selectedGroupForMonitor.value = draftGroups.value[draftGroups.value.length - 1].id
  }
}

// Add monitor to group handler
function handleAddMonitorToGroup() {
  if (!selectedGroupForMonitor.value || !selectedMonitorToAdd.value) return

  // Handle USelectMenu value - it returns the full item object when value-key is set
  const groupId = Number(selectedGroupForMonitor.value)
  let monitorId: number
  
  // USelectMenu with value-key returns the item, extract the value
  if (typeof selectedMonitorToAdd.value === 'object' && selectedMonitorToAdd.value !== null) {
    monitorId = Number((selectedMonitorToAdd.value as any).value)
  } else {
    monitorId = Number(selectedMonitorToAdd.value)
  }
  
  console.log('Adding monitor:', { groupId, monitorId, selectedValue: selectedMonitorToAdd.value })
  
  if (Number.isNaN(groupId) || Number.isNaN(monitorId)) {
    console.error('Invalid IDs:', { groupId, monitorId })
    return
  }
  
  const monitor = allMonitors.value.find(m => Number(m.id) === monitorId)
  console.log('Found monitor:', monitor)
  
  if (monitor) {
    addMonitorToGroup(groupId, monitor)
    selectedMonitorToAdd.value = null as any
  }
}

// Remove group handler
function handleRemoveGroup(groupIndex: number) {
  // Can receive groupIndex from both main content and sidebar
  const group = draftGroups.value[groupIndex]
  if (group) {
    removeGroup(group.id)
  }
}

// Rename group handler - supports both (group, name) and (groupId, name) signatures
function handleRenameGroup(groupOrId: any, name: string) {
  if (!name) return
  
  // Check if first argument is a group object or a groupId
  const groupId = typeof groupOrId === 'object' ? groupOrId.id : groupOrId
  if (!groupId) return
  
  updateGroupName(groupId, name)
}

// Remove monitor from group handler
function handleRemoveMonitor(groupIndex: number, monitorIndex: number) {
  const group = draftGroups.value[groupIndex]
  if (group) {
    const monitor = group.monitorList[monitorIndex]
    if (monitor) {
      removeMonitorFromGroup(group.id, monitor.id)
    }
  }
}

// Monitor reorder handler (drag-drop)
function handleReorderMonitors(group: any) {
  if (!group) return
  unsavedChanges.value = true
}

// Page change handler for pagination
async function handlePageChange(newPage: number) {
  if (editMode.value) return
  
  changePage(newPage)
  await loadDataForGroup(activeGroupId.value)
  
  // Load heartbeat for the new page's monitors
  const monitorIds = publicGroupList.value.flatMap(g => g.monitorList.map(m => m.id))
  if (monitorIds.length) {
    await loadHeartbeat(monitorIds)
  }
}

// Group tab click handler
async function handleGroupTabClick(groupId: number) {
  if (editMode.value) return
  
  // Set active group ID and reset to page 1
  activeGroupId.value = groupId
  changePage(1)
  
  // Load data for the selected group with pagination
  await loadDataForGroup(groupId)
  
  // Load heartbeat for this group's monitors
  const group = publicGroupList.value.find(g => g.id === groupId)
  if (group?.monitorList?.length) {
    await loadHeartbeat(group.monitorList.map(m => m.id))
  }
}

// Load data for a specific group with pagination
async function loadDataForGroup(groupId: number | null) {
  await loadData({ groupId: groupId ?? undefined })
}

// Logo upload handler
async function handleLogoUpload(dataUrl: string) {
  if (editMode.value) {
    // In edit mode, just update the draft - save will upload
    currentLogoUrl.value = dataUrl
    unsavedChanges.value = true
  } else {
    // Direct upload (shouldn't happen, but fallback)
    await uploadLogo(dataUrl)
  }
}

// Load all monitors for the selector
async function loadAllMonitors() {
  try {
    const response = await $fetch<any>('/api/v1/monitors')
    if (response.ok && response.data) {
      allMonitors.value = response.data
    }
  } catch (e) {
    console.error('Failed to load monitors:', e)
  }
}

// Watch edit mode to load monitors when entering edit mode
watch(editMode, async (newValue) => {
  if (newValue && allMonitors.value.length === 0) {
    await loadAllMonitors()
  }
  // Auto-select first group
  if (newValue && displayedGroups.value.length > 0) {
    selectedGroupForMonitor.value = displayedGroups.value[0].id
  }
})

// Format helpers
function formatLastUpdated(date: Date | null) {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
</script>

<template>
  <UApp>
    <div 
      class="min-h-screen status-page"
      :class="[
        statusPage?.theme === 'dark' ? 'status-page-dark' : 
        statusPage?.theme === 'light' ? 'status-page-light' : 
        'status-page-auto'
      ]"
    >
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center min-h-screen">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-muted">Loading status page...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center min-h-screen">
        <div class="text-center px-4">
          <h1 class="text-6xl font-bold text-dimmed mb-4">404</h1>
          <p class="text-xl text-muted mb-8">{{ error }}</p>
          <NuxtLink 
            to="/" 
            class="inline-flex items-center px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            Go Home
          </NuxtLink>
        </div>
      </div>

      <!-- Main Status Page Content -->
      <div v-else class="status-page-content">
      <!-- Edit Mode Toggle (for authenticated users) -->
      <div 
        v-if="canEdit" 
        class="fixed top-4 right-4 z-50 flex gap-2"
      >
        <button
          v-if="editMode"
          @click="exitEditMode"
          class="px-4 py-2 bg-unknown text-white rounded-lg shadow-lg hover:bg-unknown/90 transition-colors flex items-center gap-2"
        >
          <span>✕ Exit Edit</span>
        </button>
        <button
          @click="toggleEditMode"
          class="px-4 py-2 bg-default rounded-lg shadow-lg border border-default hover:bg-muted transition-colors flex items-center gap-2"
        >
          <span v-if="editMode && showEditSidebar">👁️ Hide Sidebar</span>
          <span v-else-if="editMode">⚙️ Show Sidebar</span>
          <span v-else>✏️ Edit Mode</span>
        </button>
      </div>

      <!-- Container - shifts right when sidebar is open -->
      <div 
        class="mx-auto px-4 py-12 transition-all duration-300"
        :class="{
          'max-w-4xl': !showEditSidebar,
          'ml-[340px] max-w-[calc(100%-360px)]': showEditSidebar && editMode
        }"
      >
        <!-- Header -->
        <header class="text-center mb-12 status-page-header">
          <!-- Logo with upload support in edit mode -->
          <StatusPageLogoUploader
            v-model="currentLogoUrl"
            :edit-mode="editMode"
            class="mx-auto mb-4"
            @crop-success="handleLogoUpload"
          />
          <h1 class="text-4xl font-bold mb-3 status-page-title">
            {{ statusPage?.title || 'Status' }}
          </h1>
          <!-- Description with Markdown support -->
          <div 
            v-if="statusPage?.description" 
            class="text-lg text-toned status-page-description max-w-2xl mx-auto prose dark:prose-invert"
            v-html="descriptionHtml"
          />
          
          <!-- Real-time indicator -->
          <div class="mt-6 flex items-center justify-center gap-4 text-sm text-muted">
            <div class="flex items-center gap-2">
              <span 
                class="w-2.5 h-2.5 rounded-full"
                :class="connected ? 'bg-up animate-pulse' : 'bg-unknown'"
              ></span>
              <span>{{ connected ? 'Live' : 'Offline' }}</span>
            </div>
            <span class="text-dimmed">•</span>
            <span v-if="lastUpdated">
              Updated: {{ formatLastUpdated(lastUpdated) }}
            </span>
          </div>
        </header>

        <!-- Overall Status Banner -->
        <div
          :class="[
            'rounded-xl px-4 py-3 mb-6 text-center shadow-md',
            overallStatusConfig.bgClass,
            overallStatusConfig.textClass
          ]"
        >
          <div class="flex items-center justify-center gap-2 text-lg font-semibold">
            <span class="text-xl">{{ overallStatusConfig.icon }}</span>
            <span>{{ overallStatusConfig.text }}</span>
          </div>
        </div>

        <!-- Maintenance Banner -->
        <div
          v-for="maintenance in maintenanceList"
          :key="maintenance.id"
          class="mb-4 rounded-lg border border-maintenance/40 bg-maintenance-subtle p-4"
          role="status"
        >
          <div class="flex items-start gap-3">
            <UIcon name="i-heroicons-wrench-screwdriver" class="mt-0.5 size-5 shrink-0 text-maintenance-fg" />
            <div class="min-w-0">
              <h3 class="font-semibold text-maintenance-fg">
                {{ maintenance.title }}
              </h3>
              <div
                v-if="maintenance.description"
                class="prose prose-sm mt-1 max-w-none text-default dark:prose-invert"
                v-html="renderMarkdown(maintenance.description)"
              />
              <MaintenanceTime class="mt-2" :maintenance="maintenance" />
            </div>
          </div>
        </div>

        <!-- Pinned Incidents -->
        <div v-if="editMode || incidents.length > 0" class="mb-8">
          <StatusPageIncidentEditor
            :incident="incident"
            :edit-mode="editMode"
            @post="handleIncidentPost"
            @unpin="handleUnpinIncident"
          />
        </div>

        <!-- Edit Mode Controls -->
        <div v-if="editMode" class="mb-8 edit-mode-controls">
          <div class="flex flex-wrap items-center gap-4">
            <!-- Add Group Button - Primary action button -->
            <button
              type="button"
              class="btn-add-group"
              @click="handleAddGroup"
            >
              <UIcon name="i-heroicons-plus-circle" class="w-5 h-5" />
              <span>Add Group</span>
            </button>
          </div>

          <!-- Add Monitor Selector - Full Width Below -->
          <div v-if="allMonitors.length > 0" class="add-monitor-section mt-4">
            <label class="block text-sm font-medium mb-2 edit-mode-label">
              Add a monitor:
            </label>
            <USelectMenu
              v-model="selectedMonitorToAdd"
              :items="availableMonitorOptions"
              placeholder="Search and select a monitor..."
              searchable
              class="monitor-select"
              value-key="value"
              :ui="{ base: 'w-full' }"
            >
              <template #item="{ item }">
                <div class="flex items-center gap-2 py-1">
                  <span>{{ item.label }}</span>
                  <template v-if="item.tags?.length">
                    <span 
                      v-for="tag in item.tags" 
                      :key="tag.name"
                      class="inline-block px-1.5 py-0.5 text-xs rounded"
                      :style="{ backgroundColor: tag.color || '#6b7280', color: '#fff' }"
                    >
                      {{ tag.name }}
                    </span>
                  </template>
                </div>
              </template>
            </USelectMenu>

            <!-- Add to Group Button Row -->
            <div v-if="selectedMonitorToAdd" class="flex items-center gap-2 mt-2">
              <span class="text-sm edit-mode-label">Add to:</span>
              <select
                v-model="selectedGroupForMonitor"
                class="form-select flex-shrink-0"
              >
                <option v-for="group in displayedGroups" :key="group.id" :value="group.id">
                  {{ group.name }}
                </option>
              </select>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="!selectedGroupForMonitor"
                @click="handleAddMonitorToGroup"
              >
                <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
                Add
              </button>
            </div>
          </div>

          <!-- No monitors available message -->
          <div v-if="allMonitors.length === 0" class="mt-4 text-center text-muted">
            No monitors available. 
            <NuxtLink to="/monitors/add" class="text-link hover:underline">Add one</NuxtLink>
          </div>
        </div>

        <!-- Group Tabs (if multiple groups) -->
        <div 
          v-if="!editMode && groupTabs.length > 1" 
          class="mb-6"
        >
          <div class="flex gap-2 overflow-x-auto pb-2 border-b border-default">
            <button
              v-for="tab in groupTabs"
              :key="tab.id"
              @click="handleGroupTabClick(tab.id)"
              :class="[
                'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeGroupId === tab.id
                  ? 'bg-default text-link border-b-2 border-primary'
                  : 'text-muted hover:text-default'
              ]"
            >
              {{ tab.name }}
              <span class="ml-2 text-xs text-dimmed">
                ({{ tab.count || 0 }})
              </span>
            </button>
          </div>
        </div>

        <!-- Monitor Groups -->
        <StatusPublicGroupList
          :groups="editMode ? draftGroups : displayedGroups"
          :edit-mode="editMode"
          :show-certificate-expiry="statusPage?.showCertificateExpiry"
          @update:groups="handleGroupUpdate"
          @removeGroup="handleRemoveGroup"
          @removeMonitor="handleRemoveMonitor"
          @renameGroup="handleRenameGroup"
          @reorderMonitors="handleReorderMonitors"
        />

        <!-- Pagination (only in view mode when viewing a single group with many monitors) -->
        <div 
          v-if="!editMode && pagination && pagination.totalPages > 1" 
          class="mt-8 flex flex-col items-center gap-3"
        >
          <div class="inline-flex items-center gap-1">
            <!-- First page button -->
            <button
              class="pagination-btn"
              :class="{ 'pagination-btn-disabled': !pagination.hasPrevPage }"
              :disabled="!pagination.hasPrevPage"
              @click="handlePageChange(1)"
              title="First page"
            >
              «
            </button>
            
            <!-- Previous page button -->
            <button
              class="pagination-btn"
              :class="{ 'pagination-btn-disabled': !pagination.hasPrevPage }"
              :disabled="!pagination.hasPrevPage"
              @click="handlePageChange(page - 1)"
              title="Previous page"
            >
              ‹
            </button>
            
            <!-- Page number buttons -->
            <template v-for="pageNum in visiblePageNumbers" :key="pageNum">
              <span v-if="pageNum === '...'" class="px-2 py-2 text-sm text-dimmed">...</span>
              <button
                v-else
                class="pagination-btn pagination-btn-number"
                :class="{ 'pagination-btn-active': pageNum === pagination.currentPage }"
                @click="handlePageChange(pageNum as number)"
              >
                {{ pageNum }}
              </button>
            </template>
            
            <!-- Next page button -->
            <button
              class="pagination-btn"
              :class="{ 'pagination-btn-disabled': !pagination.hasNextPage }"
              :disabled="!pagination.hasNextPage"
              @click="handlePageChange(page + 1)"
              title="Next page"
            >
              ›
            </button>
            
            <!-- Last page button -->
            <button
              class="pagination-btn"
              :class="{ 'pagination-btn-disabled': !pagination.hasNextPage }"
              :disabled="!pagination.hasNextPage"
              @click="handlePageChange(pagination.totalPages)"
              title="Last page"
            >
              »
            </button>
          </div>
        </div>

        <!-- Countdown timer (always show in view mode) -->
        <div 
          v-if="!editMode && countdown" 
          class="mt-6 flex justify-center"
        >
          <div class="text-sm text-muted flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-up animate-pulse"></span>
            <span>Auto refresh in {{ countdown }}</span>
          </div>
        </div>

        <!-- Empty State (only show in non-edit mode when no monitors) -->
        <div 
          v-if="!editMode && publicGroupList.length === 0 && hasLoaded"
          class="empty-state-card"
        >
          <div class="text-6xl mb-4">📊</div>
          <h3 class="text-xl font-medium mb-2 empty-state-title">
            No monitors configured
          </h3>
          <p class="empty-state-text">
            This status page doesn't have any monitors yet.
          </p>
        </div>

        <!-- Footer -->
        <footer class="text-center mt-16 text-sm text-muted status-page-footer">
          <!-- Footer with Markdown support -->
          <div 
            v-if="statusPage?.footerText" 
            class="mb-3 text-toned prose dark:prose-invert prose-sm mx-auto"
            v-html="footerHtml"
          />
          <p v-if="statusPage?.showPoweredBy !== false" class="flex items-center justify-center gap-1">
            Powered by
            <a 
              href="https://github.com/louislam/uptime-kuma" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-link hover:text-link hover:underline inline-flex items-center gap-1"
            >
              Uptime Kuma
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </p>
        </footer>
      </div>
    </div>

    <!-- Edit Sidebar (slides in from left) -->
    <StatusPageEditSidebar
      v-model="showEditSidebar"
      :config="draftConfig"
      :groups="draftGroups"
      :saving="saving"
      @save="saveStatusPage"
      @discard="exitEditMode"
      @delete="showDeleteConfirm = true"
      @addGroup="handleAddGroup"
      @removeGroup="handleRemoveGroup"
      @renameGroup="handleRenameGroup"
      @removeMonitor="handleRemoveMonitor"
    />

    <!-- Delete Confirmation Dialog -->
    <UModal 
      :open="showDeleteConfirm"
      @update:open="showDeleteConfirm = $event"
      title="Delete Status Page"
      description="Are you sure you want to delete this status page? This action cannot be undone."
      :ui="{ footer: 'justify-end' }"
    >
      <template #default>
        <span class="hidden"></span>
      </template>
      
      <template #footer="{ close }">
        <UButton variant="ghost" @click="close">
          Cancel
        </UButton>
        <UButton color="error" @click="handleDelete">
          Delete
        </UButton>
      </template>
    </UModal>

    <!-- No overlay - sidebar and main content are both visible -->

    <!-- Google Analytics -->
    <ClientOnly>
      <component 
        v-if="statusPage?.googleAnalyticsId" 
        :is="'script'" 
        async 
        :src="`https://www.googletagmanager.com/gtag/js?id=${statusPage.googleAnalyticsId}`"
      />
    </ClientOnly>
    </div>
  </UApp>
</template>

<style scoped>
/* Fade animation for overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Theme: colours come from tokens. The page's own theme (light/dark/auto)
   is applied by toggling the .dark class in <script>. Class names are kept
   because custom CSS written by users may target them. */
.status-page {
  background-color: var(--uk-bg-app);
  color: var(--uk-text);
}

/* Custom scrollbar for sidebar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: var(--uk-bg-active);
  border-radius: 3px;
}

/* Edit mode controls styling */
.edit-mode-controls {
  background-color: var(--uk-bg-surface);
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid var(--uk-border);
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.08);
}

.edit-mode-label {
  color: var(--uk-text);
}

/* Empty state card */
.empty-state-card {
  background-color: var(--uk-bg-surface);
  border-radius: 0.5rem;
  padding: 3rem;
  text-align: center;
  border: 1px solid var(--uk-border);
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.08);
}

.empty-state-title {
  color: var(--uk-text-secondary);
}

.empty-state-text {
  color: var(--uk-text-muted);
}

/* Add monitor section styling */
.add-monitor-section {
  padding: 1rem;
  background-color: var(--uk-bg-sunken);
  border-radius: 0.5rem;
  border: 1px solid var(--uk-border);
}

.monitor-select :deep(.select-button) {
  min-height: 42px;
}

/* Button styling */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
}

.btn-primary {
  background-color: var(--uk-status-up);
  color: white;
}

.btn-primary:hover {
  background-color: var(--uk-status-up);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Add Group Button - prominent action button */
.btn-add-group {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--uk-text-on-primary);
  background: linear-gradient(135deg, var(--uk-status-up) 0%, var(--uk-status-up) 100%);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.35);
  transition: all 0.2s ease;
}

.btn-add-group:hover {
  background: linear-gradient(135deg, var(--uk-status-up) 0%, var(--uk-green-700) 100%);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.45);
  transform: translateY(-1px);
}

.btn-add-group:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(34, 197, 94, 0.3);
}

/* Form select styling */
.form-select {
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  background-color: var(--uk-bg-surface);
  border: 1px solid var(--uk-border-strong);
  color: var(--uk-text);
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  appearance: none;
}

.dark .form-select {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
}

.form-select:focus {
  border-color: var(--uk-status-up);
  outline: none;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}

/* Pagination - Uptime Kuma style */
.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--uk-text-secondary);
  background-color: var(--uk-bg-surface);
  border: 1px solid var(--uk-border-strong);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
  background-color: var(--uk-bg-sunken);
  border-color: var(--uk-border-strong);
}

.pagination-btn-number {
  min-width: 40px;
}

/* Active page - brand primary */
.pagination-btn-active {
  color: var(--uk-text-on-primary);
  background-color: var(--uk-status-up);
  border-color: var(--uk-status-up);
}

.pagination-btn-active:hover:not(:disabled) {
  background-color: var(--uk-primary-hover);
  border-color: var(--uk-primary-hover);
}

/* Disabled state */
.pagination-btn-disabled {
  color: var(--uk-text-muted);
  background-color: var(--uk-bg-sunken);
  border-color: var(--uk-border);
  cursor: not-allowed;
}

/* Dark mode */
</style>
