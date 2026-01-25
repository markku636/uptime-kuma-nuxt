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
  incident,
  maintenanceList,
  lastUpdateTime: lastUpdated,
  updateCountdownText: countdown,
  
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

// Active group tab
const activeGroupIndex = ref(0)

// Source of groups (draft when editing, public when viewing)
const groupSource = computed(() => editMode.value ? draftGroups.value : publicGroupList.value)

// Monitor selection state for edit mode
const allMonitors = ref<any[]>([])
const selectedGroupForMonitor = ref<number | null>(null)
const selectedMonitorToAdd = ref<number | ''>('')

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

// Page head management
useHead({
  title: computed(() => statusPage.value?.title ? `${statusPage.value.title} - Status` : 'Status'),
})

// Initialize on mount
onMounted(async () => {
  await init()
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

// Active group (for tab navigation)
const activeGroup = computed(() => {
  if (groupSource.value.length === 0) return null
  return groupSource.value[activeGroupIndex.value] || groupSource.value[0]
})

// Show all groups or just active group based on layout
const showAllGroups = computed(() => {
  // In edit mode always show all groups to match legacy UX
  if (editMode.value) return true
  // Show all if only one group or no tabs
  return publicGroupList.value.length <= 1 || !statusPage.value?.showTabs
})

// Displayed groups
const displayedGroups = computed(() => {
  if (showAllGroups.value) return groupSource.value
  return activeGroup.value ? [activeGroup.value] : []
})

// Edit mode handlers
async function toggleEditMode() {
  if (!editMode.value) {
    // Load full, unpaginated data before entering edit mode so all groups/monitors are available
    await loadData({ noPagination: true })

    enableEditMode()

    // Ensure there is at least one group to receive monitors (parity with legacy page)
    if (draftGroups.value.length === 0) {
      addGroup()
    }
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
  } else {
    console.error('Failed to save status page:', result.error)
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

  // Normalize IDs to handle numeric/string values from API
  const groupId = Number(selectedGroupForMonitor.value)
  const monitorId = Number(selectedMonitorToAdd.value)
  if (Number.isNaN(groupId) || Number.isNaN(monitorId)) return
  
  const monitor = allMonitors.value.find(m => Number(m.id) === monitorId)
  if (monitor) {
    addMonitorToGroup(groupId, monitor)
    selectedMonitorToAdd.value = ''
  }
}

// Remove group handler
function handleRemoveGroup(groupIndex: number) {
  const group = displayedGroups.value[groupIndex]
  if (group) {
    removeGroup(group.id)
  }
}

// Rename group handler
function handleRenameGroup(group: any, name: string) {
  if (!group || !name) return
  updateGroupName(group.id, name)
}

// Remove monitor from group handler
function handleRemoveMonitor(groupIndex: number, monitorIndex: number) {
  const group = displayedGroups.value[groupIndex]
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

// Logo upload handler
async function handleLogoUpload(logoDataUrl: string) {
  const result = await uploadLogo(logoDataUrl)
  if (!result.success) {
    console.error('Failed to upload logo:', result.error)
  }
}

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

      <!-- Container -->
      <div class="max-w-4xl mx-auto px-4 py-12">
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
              <span 
                class="w-2.5 h-2.5 rounded-full"
                :class="connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'"
              ></span>
              <span>{{ connected ? 'Live' : 'Offline' }}</span>
            </div>
            <span class="text-gray-300 dark:text-gray-600">•</span>
            <span v-if="lastUpdated">
              Updated: {{ formatLastUpdated(lastUpdated) }}
            </span>
            <span v-if="countdown" class="text-gray-500 dark:text-gray-400">
              ({{ countdown }})
            </span>
          </div>
        </header>

        <!-- Overall Status Banner -->
        <div
          :class="[
            'rounded-xl p-6 mb-8 text-center shadow-lg',
            overallStatusConfig.bgClass,
            overallStatusConfig.textClass
          ]"
        >
          <div class="flex items-center justify-center gap-3 text-2xl font-semibold">
            <span class="text-3xl">{{ overallStatusConfig.icon }}</span>
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

        <!-- Edit Mode Controls -->
        <div v-if="editMode" class="mb-8 edit-mode-controls">
          <div class="flex flex-wrap items-center gap-4">
            <!-- Add Group Button -->
            <button
              type="button"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              @click="handleAddGroup"
            >
              <UIcon name="i-heroicons-plus" class="w-5 h-5" />
              Add Group
            </button>

            <!-- Add Monitor Selector -->
            <div class="flex-1 min-w-[250px]">
              <label class="block text-sm font-medium mb-1 edit-mode-label">
                Add a monitor to group:
              </label>
              <div class="flex gap-2">
                <select
                  v-model="selectedGroupForMonitor"
                  class="form-select flex-shrink-0 w-40"
                >
                  <option v-for="group in displayedGroups" :key="group.id" :value="group.id">
                    {{ group.name }}
                  </option>
                </select>
                <select
                  v-model="selectedMonitorToAdd"
                  class="form-select flex-1"
                  :disabled="!selectedGroupForMonitor"
                >
                  <option value="">-- Select a monitor --</option>
                  <option 
                    v-for="monitor in availableMonitors" 
                    :key="monitor.id" 
                    :value="monitor.id"
                  >
                    {{ monitor.name }}
                  </option>
                </select>
                <button
                  type="button"
                  class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  :disabled="!selectedMonitorToAdd"
                  @click="handleAddMonitorToGroup"
                >
                  <UIcon name="i-heroicons-plus" class="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <!-- No monitors available message -->
          <div v-if="allMonitors.length === 0" class="mt-4 text-center text-gray-500 dark:text-gray-400">
            No monitors available. 
            <NuxtLink to="/monitors/add" class="text-primary-500 hover:underline">Add one</NuxtLink>
          </div>
        </div>

        <!-- Group Tabs (if multiple groups with tabs enabled) -->
        <div 
          v-if="!editMode && publicGroupList.length > 1 && statusPage?.showTabs" 
          class="mb-6"
        >
          <div class="flex gap-2 overflow-x-auto pb-2 border-b border-gray-200 dark:border-gray-700">
            <button
              v-for="(group, index) in publicGroupList"
              :key="group.id"
              @click="activeGroupIndex = index"
              :class="[
                'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeGroupIndex === index
                  ? 'bg-white dark:bg-gray-800 text-primary-600 border-b-2 border-primary-500'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              ]"
            >
              {{ group.name }}
              <span class="ml-2 text-xs text-gray-400">
                ({{ group.monitorList?.length || 0 }})
              </span>
            </button>
          </div>
        </div>

        <!-- Monitor Groups -->
        <StatusPublicGroupList
          :groups="displayedGroups"
          :edit-mode="editMode"
          :show-certificate-expiry="statusPage?.showCertificateExpiry"
          @update:groups="handleGroupUpdate"
          @removeGroup="handleRemoveGroup"
          @removeMonitor="handleRemoveMonitor"
          @renameGroup="handleRenameGroup"
          @reorderMonitors="handleReorderMonitors"
        />

        <!-- Empty State -->
        <div 
          v-if="publicGroupList.length === 0 && hasLoaded"
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
              href="https://github.com/louislam/uptime-kuma" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-primary-500 hover:text-primary-600 hover:underline inline-flex items-center gap-1"
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
      :saving="saving"
      @save="saveStatusPage"
      @discard="exitEditMode"
      @delete="showDeleteConfirm = true"
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

    <!-- Sidebar Overlay -->
    <Transition name="fade">
      <div
        v-if="editMode && showEditSidebar"
        class="fixed inset-0 bg-black/30 z-30"
        @click="showEditSidebar = false"
      ></div>
    </Transition>

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
</style>
