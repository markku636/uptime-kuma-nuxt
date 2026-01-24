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

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Use the status page composable
const {
  config: statusPage,
  groups: publicGroupList,
  incident,
  maintenanceList,
  loading,
  error,
  lastUpdateTime: lastUpdated,
  updateCountdownText: countdown,
  init,
  stopAutoRefresh: cleanup
} = usePublicStatusPage(slug)

// Computed for backwards compatibility
const incidents = computed(() => incident.value ? [incident.value] : [])
const connected = ref(true)
const isFirstLoaded = computed(() => !loading.value)

// Edit mode state (requires auth)
const editMode = ref(false)
const showEditSidebar = ref(false)
const saving = ref(false)

// Active group tab
const activeGroupIndex = ref(0)

// Check if user has edit permission
const { data: session } = useAuth()
const canEdit = computed(() => !!session.value?.user)

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
  cleanup()
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
const overallStatus = computed(() => {
  const allMonitors = publicGroupList.value.flatMap(g => g.monitorList || [])
  if (allMonitors.length === 0) return 'unknown'
  
  // Check for maintenance
  if (maintenanceList.value.length > 0) {
    return 'maintenance'
  }
  
  const downMonitors = allMonitors.filter(m => {
    const lastHeartbeat = m.heartbeats?.[0]
    return lastHeartbeat && lastHeartbeat.status === 0 // DOWN
  })
  
  const pendingMonitors = allMonitors.filter(m => {
    const lastHeartbeat = m.heartbeats?.[0]
    return lastHeartbeat && lastHeartbeat.status === 2 // PENDING
  })
  
  if (downMonitors.length === 0 && pendingMonitors.length === 0) return 'operational'
  if (downMonitors.length === allMonitors.length) return 'major-outage'
  if (downMonitors.length > 0) return 'partial-outage'
  return 'degraded'
})

const overallStatusConfig = computed(() => {
  switch (overallStatus.value) {
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
    case 'degraded':
      return { 
        text: 'Degraded Performance', 
        icon: '~',
        bgClass: 'bg-orange-500',
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
  if (publicGroupList.value.length === 0) return null
  return publicGroupList.value[activeGroupIndex.value] || publicGroupList.value[0]
})

// Show all groups or just active group based on layout
const showAllGroups = computed(() => {
  // Show all if only one group or no tabs
  return publicGroupList.value.length <= 1 || !statusPage.value?.showTabs
})

// Displayed groups
const displayedGroups = computed(() => {
  if (showAllGroups.value) return publicGroupList.value
  return activeGroup.value ? [activeGroup.value] : []
})

// Edit mode handlers
function toggleEditMode() {
  editMode.value = !editMode.value
  showEditSidebar.value = editMode.value
}

async function saveStatusPage() {
  if (!canEdit.value) return
  
  saving.value = true
  try {
    // TODO: Implement save via WebSocket or API
    console.log('Saving status page...', statusPage.value)
  } catch (e) {
    console.error('Failed to save status page:', e)
  } finally {
    saving.value = false
  }
}

// Incident handlers
function handleIncidentEdit(incident: any) {
  // TODO: Open incident edit modal
  console.log('Edit incident:', incident)
}

function handleUnpinIncident(incidentId: number) {
  // TODO: Implement unpin via WebSocket
  console.log('Unpin incident:', incidentId)
}

// Group handlers
function handleGroupUpdate(groups: any[]) {
  // Update group order
  publicGroupList.value = groups
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

function formatCountdown(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div 
    class="min-h-screen status-page"
    :class="[
      statusPage?.theme === 'dark' ? 'bg-gray-900 text-white' : 
      statusPage?.theme === 'light' ? 'bg-gray-50 text-gray-900' : 
      'bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white'
    ]"
  >
    <!-- Loading State -->
    <div v-if="loading && !isFirstLoaded" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-500 dark:text-gray-400">Loading status page...</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error && !isFirstLoaded" class="flex items-center justify-center min-h-screen">
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
        class="fixed top-4 right-4 z-50"
      >
        <button
          @click="toggleEditMode"
          class="px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <span v-if="editMode">👁️ View Mode</span>
          <span v-else>✏️ Edit Mode</span>
        </button>
      </div>

      <!-- Container -->
      <div class="max-w-4xl mx-auto px-4 py-12">
        <!-- Header -->
        <header class="text-center mb-12 status-page-header">
          <img
            v-if="statusPage?.icon"
            :src="statusPage.icon"
            :alt="statusPage.title"
            class="w-20 h-20 mx-auto mb-4 rounded-xl shadow-lg status-page-logo"
          />
          <h1 class="text-4xl font-bold mb-3 status-page-title">
            {{ statusPage?.title || 'Status' }}
          </h1>
          <p 
            v-if="statusPage?.description" 
            class="text-lg text-gray-600 dark:text-gray-400 status-page-description max-w-2xl mx-auto"
          >
            {{ statusPage.description }}
          </p>
          
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
            <span v-if="countdown > 0" class="text-gray-500 dark:text-gray-400">
              ({{ formatCountdown(countdown) }})
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
        <div v-if="incidents.length > 0" class="mb-8 space-y-4">
          <StatusIncidentBanner
            v-for="incident in incidents"
            :key="incident.id"
            :incident="incident"
            :edit-mode="editMode"
            @edit="handleIncidentEdit"
            @unpin="handleUnpinIncident"
          />
        </div>

        <!-- Group Tabs (if multiple groups with tabs enabled) -->
        <div 
          v-if="publicGroupList.length > 1 && statusPage?.showTabs" 
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
        />

        <!-- Empty State -->
        <div 
          v-if="publicGroupList.length === 0 && isFirstLoaded"
          class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center"
        >
          <div class="text-6xl mb-4">📊</div>
          <h3 class="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
            No monitors configured
          </h3>
          <p class="text-gray-500 dark:text-gray-400">
            This status page doesn't have any monitors yet.
          </p>
        </div>

        <!-- Footer -->
        <footer class="text-center mt-16 text-sm text-gray-500 dark:text-gray-400 status-page-footer">
          <p v-if="statusPage?.footerText" class="mb-3 text-gray-600 dark:text-gray-300">
            {{ statusPage.footerText }}
          </p>
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

    <!-- Edit Sidebar (slides in from right) -->
    <Transition name="slide-right">
      <div 
        v-if="editMode && showEditSidebar"
        class="fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl z-40 overflow-y-auto"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold">Edit Status Page</h2>
            <button
              @click="showEditSidebar = false"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              ✕
            </button>
          </div>

          <!-- Status Page Settings -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Title</label>
              <input
                v-model="statusPage.title"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Description</label>
              <textarea
                v-model="statusPage.description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              ></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Theme</label>
              <select
                v-model="statusPage.theme"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <div class="flex items-center gap-2">
              <input
                v-model="statusPage.showPoweredBy"
                type="checkbox"
                id="showPoweredBy"
                class="rounded"
              />
              <label for="showPoweredBy" class="text-sm">Show "Powered by Uptime Kuma"</label>
            </div>

            <div class="flex items-center gap-2">
              <input
                v-model="statusPage.showCertificateExpiry"
                type="checkbox"
                id="showCertificateExpiry"
                class="rounded"
              />
              <label for="showCertificateExpiry" class="text-sm">Show Certificate Expiry</label>
            </div>

            <div class="flex items-center gap-2">
              <input
                v-model="statusPage.showTabs"
                type="checkbox"
                id="showTabs"
                class="rounded"
              />
              <label for="showTabs" class="text-sm">Show Group Tabs</label>
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Footer Text</label>
              <input
                v-model="statusPage.footerText"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-1">Custom CSS</label>
              <textarea
                v-model="statusPage.customCss"
                rows="6"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                placeholder=".status-page { }"
              ></textarea>
            </div>
          </div>

          <!-- Save Button -->
          <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="saveStatusPage"
              :disabled="saving"
              class="w-full px-4 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              <span v-if="saving" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>{{ saving ? 'Saving...' : 'Save Changes' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

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
</template>

<style scoped>
/* Slide animation for sidebar */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease;
}

.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

/* Fade animation for overlay */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
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
</style>
