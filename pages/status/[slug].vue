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

// Public status page - no auth required for viewing
definePageMeta({
  layout: false
})

import { marked } from 'marked'
import DOMPurify from 'dompurify'
import dayjs from 'dayjs'

function incidentContentHtml(item: any) {
  return item?.content ? DOMPurify.sanitize(marked(String(item.content)) as string) : ''
}

function incidentDate(item: any) {
  const value = item?.createdDate || item?.lastUpdatedDate
  if (!value) return ''
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dayjs(date).format('YYYY-MM-DD HH:mm') : ''
}

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
  incidents,
  maintenanceList,
  lastUpdateTime: lastUpdated,
  updateCountdownText: countdown,
  pagination,
  page,
  search,
  
  // UI State
  loading,
  error,
  passwordRequired,
  passwordError,
  unlockStatusPage,
  
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
  reorderGroups,
  addMonitorToGroup,
  removeMonitorFromGroup,
  uploadLogo
} = usePublicStatusPage(slug)

// Other state
const showEditSidebar = ref(false)
const showDeleteConfirm = ref(false)
const statusPassword = ref('')
const unlocking = ref(false)
async function submitPassword() {
  unlocking.value = true
  try {
    await unlockStatusPage(statusPassword.value)
    statusPassword.value = ''
  } finally {
    unlocking.value = false
  }
}

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

// Edit permission is decided by the server for this status page's workspace.
const canEdit = computed(() => !!statusPage.value?.canEdit)

const connected = ref(true)
const hasLoaded = computed(() => !loading.value)

// Markdown rendering for description and footer
const { renderMarkdown } = useMarkdown()
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

// Page head management — shareable status pages need useful social/OpenGraph metadata
const siteTitle = computed(() => statusPage.value?.title ? `${statusPage.value.title} - Status` : 'Status')
const siteDescription = computed(() => statusPage.value?.description || 'Live service status and incident updates')
const appUrl = useRuntimeConfig().public.appUrl
const shareUrl = computed(() => `${appUrl}/status/${slug.value}`)
useHead({
  title: siteTitle,
  meta: [
    { name: 'description', content: siteDescription },
    { property: 'og:title', content: siteTitle },
    { property: 'og:description', content: siteDescription },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: shareUrl },
    { name: 'twitter:card', content: 'summary' },
  ],
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
const overallStatusConfig = computed(() => {
  const hasMonitors = publicGroupList.value.some(group => (group.monitorList || []).length > 0)
  if (!hasMonitors) {
    return { text: 'No monitors configured', icon: 'ℹ', bgClass: 'bg-slate-500', textClass: 'text-white' }
  }
  if (overallStatusType.value === 'unknown') {
    return { text: 'Waiting for first check', icon: '◷', bgClass: 'bg-slate-500', textClass: 'text-white' }
  }
  switch (overallStatusType.value) {
    case 'operational':
      return { 
        text: 'All Systems Operational', 
        icon: '✓',
        bgClass: 'bg-green-500',
        textClass: 'text-white'
      }
    case 'partial-outage':
      return { 
        text: 'Partial System Outage', 
        icon: '⚠',
        bgClass: 'bg-yellow-500',
        textClass: 'text-white'
      }
    case 'major-outage':
      return { 
        text: 'Major System Outage', 
        icon: '✕',
        bgClass: 'bg-red-500',
        textClass: 'text-white'
      }
    case 'maintenance':
      return { 
        text: 'Scheduled Maintenance', 
        icon: '🔧',
        bgClass: 'bg-blue-500',
        textClass: 'text-white'
      }
    default:
      return { 
        text: 'Status Unknown', 
        icon: '?',
        bgClass: 'bg-gray-500',
        textClass: 'text-white'
      }
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
          <div class="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-500 dark:text-gray-400">Loading status page...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center min-h-screen">
        <div class="text-center px-4">
          <h1 class="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">404</h1>
          <p class="text-xl text-gray-500 dark:text-gray-400 mb-8">{{ error }}</p>
          <NuxtLink 
            to="/" 
            class="inline-flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Go Home
          </NuxtLink>
        </div>
      </div>

      <!-- Password gate -->
      <div v-else-if="passwordRequired" class="flex items-center justify-center min-h-screen px-4">
        <form class="w-full max-w-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-lg" @submit.prevent="submitPassword">
          <h1 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Password required</h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">This status page is protected. Enter the password to view it.</p>
          <input
            v-model="statusPassword"
            type="password"
            autocomplete="current-password"
            aria-label="Status page password"
            placeholder="Password"
            required
            class="w-full rounded border border-gray-300 dark:border-gray-600 bg-transparent px-3 py-2 text-gray-900 dark:text-white mb-3"
          />
          <p v-if="passwordError" role="alert" class="text-sm text-red-500 mb-3">{{ passwordError }}</p>
          <button type="submit" :disabled="unlocking" class="w-full rounded bg-emerald-500 px-4 py-2 font-medium text-white hover:bg-emerald-600 disabled:opacity-60">
            {{ unlocking ? 'Checking…' : 'View status page' }}
          </button>
        </form>
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
          class="px-4 py-2 bg-gray-500 text-white rounded-lg shadow-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
        >
          <span>✕ Exit Edit</span>
        </button>
        <button
          @click="toggleEditMode"
          class="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
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
            class="text-lg text-gray-600 dark:text-gray-400 status-page-description max-w-2xl mx-auto prose dark:prose-invert"
            v-html="descriptionHtml"
          />
          
          <!-- Real-time indicator -->
          <div class="mt-6 flex items-center justify-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Auto-refresh</span>
            </div>
            <template v-if="lastUpdated">
              <span class="text-gray-300 dark:text-gray-600">•</span>
              <span>Updated: {{ formatLastUpdated(lastUpdated) }}</span>
            </template>
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
          class="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4"
        >
          <div class="flex items-start gap-3">
            <span class="text-blue-500 text-xl">🔧</span>
            <div>
              <h3 class="font-semibold text-blue-800 dark:text-blue-200">
                {{ maintenance.title }}
              </h3>
              <p class="text-sm text-blue-600 dark:text-blue-300 mt-1">
                {{ maintenance.description }}
              </p>
              <p class="text-xs text-blue-500 dark:text-blue-400 mt-2">
                {{ maintenance.startTime }} - {{ maintenance.endTime }}
              </p>
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

        <!-- Incident history (UptimeRobot-style timeline) -->
        <div v-if="!editMode && incidents.length > 1" class="mb-8">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">{{ 'Incident history' }}</h2>
          <div class="space-y-3">
            <article
              v-for="item in incidents.slice(1)"
              :key="item.id"
              class="rounded-lg border border-default bg-white dark:bg-gray-900 p-4 shadow-sm"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-medium text-gray-900 dark:text-gray-100">{{ item.title }}</h3>
                <span class="text-xs text-gray-500">{{ incidentDate(item) }}</span>
              </div>
              <div
                v-if="incidentContentHtml(item)"
                class="incident-history-content text-sm text-gray-600 dark:text-gray-400 mt-2 prose dark:prose-invert prose-sm max-w-none"
                v-html="incidentContentHtml(item)"
              />
            </article>
          </div>
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
              :content="{ side: 'bottom', sideOffset: 6, collisionPadding: 12 }"
              :ui="{ base: 'w-full', content: 'z-50 max-h-72 overflow-y-auto w-[var(--reka-select-trigger-width)]' }"
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
          <div v-if="allMonitors.length === 0" class="mt-4 text-center text-gray-500 dark:text-gray-400">
            No monitors available. 
            <NuxtLink to="/monitors/add" class="text-primary-500 hover:underline">Add one</NuxtLink>
          </div>
        </div>

        <!-- Search (view mode only) -->
        <div v-if="!editMode && publicGroupList.length" class="mb-4">
          <label class="relative block max-w-sm">
            <span class="sr-only">Search monitors</span>
            <UIcon name="i-heroicons-magnifying-glass" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              v-model="search"
              type="search"
              placeholder="Search monitors…"
              aria-label="Search monitors"
              maxlength="200"
              class="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
        </div>

        <!-- Group Tabs (if multiple groups) -->
        <div 
          v-if="!editMode && groupTabs.length > 1" 
          class="mb-6"
        >
          <div class="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700">
            <button
              v-for="tab in groupTabs"
              :key="tab.id"
              @click="handleGroupTabClick(tab.id)"
              :class="[
                'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeGroupId === tab.id
                  ? 'bg-white dark:bg-gray-800 text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ tab.name }}
              <span class="ml-2 text-xs text-gray-400">
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
          @monitorSettings="unsavedChanges = true"
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
              <span v-if="pageNum === '...'" class="px-2 py-2 text-sm text-gray-400 dark:text-gray-500">...</span>
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
          <div class="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Auto refresh in {{ countdown }}</span>
          </div>
        </div>

        <!-- Empty State (only show in non-edit mode when no monitors) -->
        <div 
          v-if="!editMode && publicGroupList.length === 0 && hasLoaded"
          class="empty-state-card"
        >
          <div class="mx-auto mb-4 w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <UIcon name="i-heroicons-chart-bar" class="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <h3 class="text-xl font-medium mb-2 empty-state-title">
            No monitors configured
          </h3>
          <p class="empty-state-text">
            This status page doesn't have any monitors yet. Once monitors are added, their live status and uptime will appear here.
          </p>
        </div>

        <!-- Footer -->
        <footer class="text-center mt-16 text-sm text-gray-500 dark:text-gray-400 status-page-footer">
          <!-- Footer with Markdown support -->
          <div 
            v-if="statusPage?.footerText" 
            class="mb-3 text-gray-600 dark:text-gray-300 prose dark:prose-invert prose-sm mx-auto"
            v-html="footerHtml"
          />
          <p v-if="statusPage?.showPoweredBy !== false" class="flex items-center justify-center gap-1">
            Powered by
            <a 
              href="https://github.com/markku636/uptime-kuma-nuxt" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-primary-500 hover:text-primary-600 hover:underline inline-flex items-center gap-1"
            >
              SealWatch
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </a>
          </p>
        </footer>
      </div>
    </div>

    <!-- Edit Sidebar (only rendered while an authorized editor is in edit mode) -->
    <StatusPageEditSidebar
      v-if="canEdit && editMode && showEditSidebar"
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

/* Status page theme variants */
.status-page-light {
  background-color: #f7f9fc;
  color: #0f172a;
}

.status-page-dark {
  background-color: #0d1117;
  color: #e5e7eb;
}

.status-page-auto {
  background-color: #f7f9fc;
  color: #0f172a;
}

.dark .status-page-auto {
  background-color: #0d1117;
  color: #e5e7eb;
}

/* Light mode text overrides for status page */
.status-page-light .text-gray-600,
.status-page-auto .text-gray-600 {
  color: #475569 !important;
}

.status-page-light .text-gray-500,
.status-page-auto .text-gray-500 {
  color: #64748b !important;
}

.status-page-light .text-gray-400,
.status-page-auto .text-gray-400 {
  color: #94a3b8 !important;
}

/* Edit mode controls light styling */
.status-page-light .bg-white,
.status-page-auto .bg-white {
  background-color: #ffffff !important;
  border: 1px solid #d6deea;
}

.status-page-light .border-gray-200,
.status-page-auto .border-gray-200 {
  border-color: #d6deea !important;
}

/* Form select styling for light mode */
.status-page-light .form-select,
.status-page-auto .form-select {
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  color: #0f172a;
}

.status-page-light .form-select:focus,
.status-page-auto .form-select:focus {
  border-color: #12b06a;
  outline: none;
  box-shadow: 0 0 0 2px rgba(18, 176, 106, 0.25);
}

/* Custom scrollbar for sidebar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background: #475569;
}

/* Edit mode controls styling */
.edit-mode-controls {
  background-color: #ffffff;
  border-radius: 0.5rem;
  padding: 1.5rem;
  border: 1px solid #d6deea;
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.08);
}

.dark .edit-mode-controls {
  background-color: #1f2937;
  border-color: #374151;
}

.edit-mode-label {
  color: #1f2937;
}

.dark .edit-mode-label {
  color: #d1d5db;
}

/* Empty state card */
.empty-state-card {
  background-color: #ffffff;
  border-radius: 0.5rem;
  padding: 3rem;
  text-align: center;
  border: 1px solid #d6deea;
  box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.08);
}

.dark .empty-state-card {
  background-color: #1f2937;
  border-color: #374151;
}

.empty-state-title {
  color: #334155;
}

.dark .empty-state-title {
  color: #d1d5db;
}

.empty-state-text {
  color: #64748b;
}

.dark .empty-state-text {
  color: #9ca3af;
}

/* Add monitor section styling */
.add-monitor-section {
  padding: 1rem;
  background-color: #f8fafc;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
}

.dark .add-monitor-section {
  background-color: #1f2937;
  border-color: #374151;
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
  background-color: var(--uk-primary);
  color: var(--uk-on-primary);
}

.btn-primary:hover {
  background-color: var(--uk-primary-hover);
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
  color: #ffffff;
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.35);
  transition: all 0.2s ease;
}

.btn-add-group:hover {
  background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
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
  background-color: #ffffff;
  border: 1px solid #cbd5e1;
  color: #0f172a;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;
  appearance: none;
}

.dark .form-select {
  background-color: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
}

.form-select:focus {
  border-color: #22c55e;
  outline: none;
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}

/* Pagination - SealWatch style */
.pagination-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  background-color: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pagination-btn:hover:not(:disabled) {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.pagination-btn-number {
  min-width: 40px;
}

/* Active page - SealWatch green (#5cdd8b) */
.pagination-btn-active {
  color: #ffffff;
  background-color: #5cdd8b;
  border-color: #5cdd8b;
}

.pagination-btn-active:hover:not(:disabled) {
  background-color: #7ce8a4;
  border-color: #7ce8a4;
}

/* Disabled state */
.pagination-btn-disabled {
  color: #9ca3af;
  background-color: #f9fafb;
  border-color: #e5e7eb;
  cursor: not-allowed;
}

/* Dark mode */
.dark .pagination-btn {
  color: #d1d5db;
  background-color: #0d1117;
  border-color: #1d2634;
}

.dark .pagination-btn:hover:not(:disabled) {
  background-color: #161b22;
  border-color: #30363d;
}

.dark .pagination-btn-active {
  color: #020b05;
  background-color: #5cdd8b;
  border-color: #5cdd8b;
}

.dark .pagination-btn-active:hover:not(:disabled) {
  background-color: #7ce8a4;
  border-color: #7ce8a4;
}

.dark .pagination-btn-disabled {
  color: #484f58;
  background-color: #0d1117;
  border-color: #1d2634;
}
</style>
