<template>
  <div class="edit-sidebar" :class="{ 'sidebar-open': modelValue }">
    <!-- Sidebar Body -->
    <div class="sidebar-body">
      <h3 class="sidebar-title">Edit Status Page</h3>

      <!-- Slug -->
      <div class="form-group">
        <label for="slug" class="form-label">Slug</label>
        <div class="input-group">
          <span class="input-group-text">/status/</span>
          <input
            id="slug"
            v-model="localConfig.slug"
            type="text"
            class="form-control"
            placeholder="my-status-page"
          />
        </div>
      </div>

      <!-- Title -->
      <div class="form-group">
        <label for="title" class="form-label">Title</label>
        <input
          id="title"
          v-model="localConfig.title"
          type="text"
          class="form-control"
          placeholder="My Status Page"
        />
      </div>

      <!-- Description -->
      <div class="form-group">
        <label for="description" class="form-label">Description</label>
        <textarea
          id="description"
          v-model="localConfig.description"
          class="form-control"
          rows="3"
          placeholder="Describe your status page..."
        ></textarea>
        <div class="form-text">Markdown supported</div>
      </div>

      <!-- Footer Text -->
      <div class="form-group">
        <label for="footer-text" class="form-label">Footer Text</label>
        <textarea
          id="footer-text"
          v-model="localConfig.footerText"
          class="form-control"
          rows="2"
          placeholder="Custom footer text..."
        ></textarea>
        <div class="form-text">Markdown supported</div>
      </div>

      <!-- Auto Refresh Interval -->
      <div class="form-group">
        <label for="refresh-interval" class="form-label">Refresh Interval (seconds)</label>
        <input
          id="refresh-interval"
          v-model.number="localConfig.autoRefreshInterval"
          type="number"
          class="form-control"
          min="5"
          placeholder="300"
        />
        <div class="form-text">
          Status page will auto-refresh every {{ localConfig.autoRefreshInterval || 300 }} seconds
        </div>
      </div>

      <!-- Theme -->
      <div class="form-group">
        <label for="theme" class="form-label">Theme</label>
        <select id="theme" v-model="localConfig.theme" class="form-select">
          <option value="auto">Auto</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <!-- Show Tags -->
      <div class="form-check">
        <input
          id="showTags"
          v-model="localConfig.showTags"
          type="checkbox"
          class="form-check-input"
        />
        <label class="form-check-label" for="showTags">Show Tags</label>
      </div>

      <!-- Show Powered By -->
      <div class="form-check">
        <input
          id="showPoweredBy"
          v-model="localConfig.showPoweredBy"
          type="checkbox"
          class="form-check-input"
        />
        <label class="form-check-label" for="showPoweredBy">Show Powered By</label>
      </div>

      <!-- Show Certificate Expiry -->
      <div class="form-check">
        <input
          id="showCertificateExpiry"
          v-model="localConfig.showCertificateExpiry"
          type="checkbox"
          class="form-check-input"
        />
        <label class="form-check-label" for="showCertificateExpiry">Show Certificate Expiry</label>
      </div>

      <!-- Domain Names -->
      <div class="form-group">
        <label class="form-label">
          Domain Names
          <button
            type="button"
            class="btn-icon-add"
            @click="addDomain"
            title="Add domain"
          >
            <UIcon name="i-heroicons-plus-circle" />
          </button>
        </label>
        <div class="domain-list">
          <div
            v-for="(domain, index) in localConfig.domainNameList"
            :key="index"
            class="domain-item"
          >
            <input
              v-model="localConfig.domainNameList[index]"
              type="text"
              class="form-control"
              placeholder="example.com"
            />
            <button
              type="button"
              class="btn-icon-remove"
              @click="removeDomain(index)"
              title="Remove domain"
            >
              <UIcon name="i-heroicons-x-mark" />
            </button>
          </div>
        </div>
      </div>

      <!-- Google Analytics -->
      <div class="form-group">
        <label for="googleAnalyticsId" class="form-label">Google Analytics ID</label>
        <input
          id="googleAnalyticsId"
          v-model="localConfig.googleAnalyticsId"
          type="text"
          class="form-control"
          placeholder="G-XXXXXXXXXX"
        />
      </div>

      <!-- Custom CSS -->
      <div class="form-group">
        <label for="customCSS" class="form-label">Custom CSS</label>
        <textarea
          id="customCSS"
          v-model="localConfig.customCSS"
          class="form-control css-editor"
          rows="6"
          placeholder="body { }"
        ></textarea>
      </div>

      <!-- Monitors Section -->
      <div class="monitors-section">
        <h4 class="section-title">
          Monitors
          <button
            type="button"
            class="btn-icon-add"
            @click="showMonitorSelector = true"
            title="Add monitors"
          >
            <UIcon name="i-heroicons-plus-circle" />
          </button>
        </h4>
        
        <div v-if="selectedMonitors.length === 0" class="empty-monitors">
          <p class="text-sm text-gray-500">No monitors added yet.</p>
          <button
            type="button"
            class="btn btn-sm btn-outline mt-2"
            @click="showMonitorSelector = true"
          >
            <UIcon name="i-heroicons-plus" class="me-1" />
            Add Monitors
          </button>
        </div>
        
        <div v-else class="monitor-list">
          <div
            v-for="monitor in selectedMonitors"
            :key="monitor.id"
            class="monitor-item"
          >
            <span class="monitor-name">{{ monitor.name }}</span>
            <button
              type="button"
              class="btn-icon-remove"
              @click="removeMonitor(monitor.id)"
              title="Remove monitor"
            >
              <UIcon name="i-heroicons-x-mark" />
            </button>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="danger-zone">
        <h4 class="danger-title">Danger Zone</h4>
        <button
          type="button"
          class="btn btn-danger"
          @click="emit('delete')"
        >
          <UIcon name="i-heroicons-trash" class="me-1" />
          Delete Status Page
        </button>
      </div>
    </div>

    <!-- Sidebar Footer -->
    <div class="sidebar-footer">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="saving"
        @click="handleSave"
      >
        <UIcon name="i-heroicons-check" class="me-1" />
        {{ saving ? 'Saving...' : 'Save' }}
      </button>
      <button
        type="button"
        class="btn btn-outline"
        @click="handleDiscard"
      >
        <UIcon name="i-heroicons-x-mark" class="me-1" />
        Discard
      </button>
    </div>

    <!-- Monitor Selector Modal -->
    <UModal 
      v-model:open="showMonitorSelector"
      title="Select Monitors"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <div v-if="loadingMonitors" class="text-center py-4">
          <div class="loading-spinner"></div>
          <p class="text-sm text-gray-500 mt-2">Loading monitors...</p>
        </div>
        
        <div v-else-if="availableMonitors.length === 0" class="text-center py-4">
          <p class="text-gray-500">No monitors available.</p>
        </div>
        
        <div v-else class="monitor-selector-list">
          <label
            v-for="monitor in availableMonitors"
            :key="monitor.id"
            class="monitor-selector-item"
          >
            <input
              type="checkbox"
              :value="monitor.id"
              v-model="selectedMonitorIds"
              class="monitor-checkbox"
            />
            <span class="monitor-info">
              <span class="monitor-name">{{ monitor.name }}</span>
              <span class="monitor-type">{{ monitor.type }}</span>
            </span>
          </label>
        </div>
      </template>
      
      <template #footer="{ close }">
        <UButton variant="ghost" @click="close">
          Cancel
        </UButton>
        <UButton color="primary" @click="confirmMonitorSelection">
          Add Selected
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
interface StatusPageConfig {
  slug: string
  title: string
  description?: string
  icon?: string
  theme: 'auto' | 'light' | 'dark'
  autoRefreshInterval: number
  published: boolean
  showTags: boolean
  showPoweredBy: boolean
  showCertificateExpiry: boolean
  customCSS?: string
  footerText?: string
  googleAnalyticsId?: string
  domainNameList?: string[]
  publicGroupList?: any[]
}

interface Monitor {
  id: number
  name: string
  type: string
}

const props = defineProps<{
  modelValue: boolean
  config: StatusPageConfig | null
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [config: StatusPageConfig]
  'discard': []
  'delete': []
  'addMonitors': [monitorIds: number[]]
  'removeMonitor': [monitorId: number]
}>()

// Monitor selector state
const showMonitorSelector = ref(false)
const loadingMonitors = ref(false)
const availableMonitors = ref<Monitor[]>([])
const selectedMonitorIds = ref<number[]>([])

// Selected monitors derived from config
const selectedMonitors = computed(() => {
  const groups = localConfig.value.publicGroupList || []
  const monitors: Monitor[] = []
  for (const group of groups) {
    if (group.monitorList) {
      for (const m of group.monitorList) {
        monitors.push({
          id: m.id || m.monitor_id,
          name: m.name || `Monitor ${m.id || m.monitor_id}`,
          type: m.type || 'http'
        })
      }
    }
  }
  return monitors
})

// Local config copy for editing
const localConfig = ref<StatusPageConfig>({
  slug: '',
  title: '',
  description: '',
  icon: '',
  theme: 'auto',
  autoRefreshInterval: 300,
  published: true,
  showTags: false,
  showPoweredBy: true,
  showCertificateExpiry: false,
  customCSS: '',
  footerText: '',
  googleAnalyticsId: '',
  domainNameList: [],
  publicGroupList: []
})

// Watch for config changes from parent
watch(() => props.config, (newConfig) => {
  if (newConfig) {
    localConfig.value = {
      ...newConfig,
      domainNameList: newConfig.domainNameList || [],
      publicGroupList: newConfig.publicGroupList || []
    }
  }
}, { immediate: true, deep: true })

// Load available monitors when selector opens
watch(showMonitorSelector, async (isOpen) => {
  if (isOpen) {
    await loadAvailableMonitors()
  }
})

// Load monitors from API
async function loadAvailableMonitors() {
  loadingMonitors.value = true
  try {
    const response = await $fetch('/api/v1/monitors')
    const data = response as any
    availableMonitors.value = (data.data || data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      type: m.type
    }))
    // Pre-select already added monitors
    selectedMonitorIds.value = selectedMonitors.value.map(m => m.id)
  } catch (error) {
    console.error('Failed to load monitors:', error)
    availableMonitors.value = []
  } finally {
    loadingMonitors.value = false
  }
}

// Confirm monitor selection
function confirmMonitorSelection() {
  // Get newly selected monitors (not already in the list)
  const existingIds = selectedMonitors.value.map(m => m.id)
  const newIds = selectedMonitorIds.value.filter(id => !existingIds.includes(id))
  
  if (newIds.length > 0) {
    // Add to default group or create one
    if (!localConfig.value.publicGroupList || localConfig.value.publicGroupList.length === 0) {
      localConfig.value.publicGroupList = [{
        id: 1,
        name: 'Services',
        weight: 1,
        monitorList: []
      }]
    }
    
    // Add monitors to the first group
    const group = localConfig.value.publicGroupList[0]
    for (const id of newIds) {
      const monitor = availableMonitors.value.find(m => m.id === id)
      if (monitor) {
        group.monitorList = group.monitorList || []
        group.monitorList.push({
          id: monitor.id,
          name: monitor.name,
          type: monitor.type
        })
      }
    }
    
    emit('addMonitors', newIds)
  }
  
  showMonitorSelector.value = false
}

// Remove a monitor
function removeMonitor(monitorId: number) {
  if (localConfig.value.publicGroupList) {
    for (const group of localConfig.value.publicGroupList) {
      if (group.monitorList) {
        group.monitorList = group.monitorList.filter((m: any) => (m.id || m.monitor_id) !== monitorId)
      }
    }
  }
  emit('removeMonitor', monitorId)
}

// Domain management
function addDomain() {
  if (!localConfig.value.domainNameList) {
    localConfig.value.domainNameList = []
  }
  localConfig.value.domainNameList.push('')
}

function removeDomain(index: number) {
  localConfig.value.domainNameList?.splice(index, 1)
}

// Actions
function handleSave() {
  emit('save', localConfig.value)
}

function handleDiscard() {
  emit('discard')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.edit-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: 320px;
  height: 100vh;
  background: #ffffff;
  border-right: 1px solid #d6deea;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 100;
  color: #0f172a;
}

.dark .edit-sidebar {
  background: #1f2937;
  border-right-color: #374151;
  color: #d1d5db;
}

.sidebar-open {
  transform: translateX(0);
}

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.sidebar-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #d6deea;
  color: #0f172a;
}

.dark .sidebar-title {
  border-bottom-color: #374151;
  color: #f9fafb;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 6px;
  color: #1f2937;
}

.dark .form-label {
  color: #e5e7eb;
}

.form-control,
.form-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.875rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #0f172a;
}

.dark .form-control,
.dark .form-select {
  background: #374151;
  border-color: #4b5563;
  color: #f9fafb;
}

.form-control:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary, #10b981);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.form-text {
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 4px;
}

.dark .form-text {
  color: #9ca3af;
}

.form-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.form-check-input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary, #10b981);
}

.form-check-label {
  font-size: 0.875rem;
  color: #1f2937;
}

.dark .form-check-label {
  color: #e5e7eb;
}

.input-group {
  display: flex;
}

.input-group-text {
  padding: 8px 12px;
  font-size: 0.875rem;
  background: #eef2f8;
  border: 1px solid #cbd5e1;
  border-right: none;
  border-radius: 6px 0 0 6px;
  color: #475569;
}

.dark .input-group-text {
  background: #1f2937;
  border-color: #4b5563;
  color: #9ca3af;
}

.input-group .form-control {
  border-radius: 0 6px 6px 0;
}

.btn-icon-add {
  background: none;
  border: none;
  color: var(--color-primary, #10b981);
  cursor: pointer;
  padding: 0;
  margin-left: 8px;
  font-size: 1.25rem;
}

.btn-icon-add:hover {
  color: var(--color-primary-dark, #059669);
}

.domain-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.domain-item {
  display: flex;
  gap: 8px;
}

.domain-item .form-control {
  flex: 1;
}

.btn-icon-remove {
  background: none;
  border: none;
  color: var(--color-danger, #ef4444);
  cursor: pointer;
  padding: 4px;
  font-size: 1.25rem;
}

.btn-icon-remove:hover {
  color: var(--color-danger-dark, #dc2626);
}

.css-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
}

.danger-zone {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-danger, #ef4444);
}

.danger-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #e11d48;
  margin-bottom: 12px;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid #d6deea;
  display: flex;
  gap: 12px;
  background: #ffffff;
}

.dark .sidebar-footer {
  background: #1f2937;
  border-top-color: #374151;
}

.btn {
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--color-primary, #10b981);
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #059669);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline {
  background: transparent;
  border: 1px solid #94a3b8;
  color: #1f2937;
}

.btn-outline:hover {
  background: #e2e8f0;
}

.dark .btn-outline {
  border-color: #4b5563;
  color: #e5e7eb;
}

.dark .btn-outline:hover {
  background: #374151;
}

.btn-danger {
  background: var(--color-danger, #ef4444);
  color: white;
  border: none;
}

.btn-danger:hover {
  background: var(--color-danger-dark, #dc2626);
}

.me-1 {
  margin-right: 4px;
}

/* Monitors Section */
.monitors-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #d6deea;
}

.dark .monitors-section {
  border-top-color: #374151;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #1e293b;
}

.dark .section-title {
  color: #e5e7eb;
}

.empty-monitors {
  text-align: center;
  padding: 16px;
  background: #f1f5f9;
  border-radius: 8px;
  color: #64748b;
}

.dark .empty-monitors {
  background: #374151;
  color: #9ca3af;
}

.monitor-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.monitor-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f1f5f9;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #0f172a;
}

.dark .monitor-item {
  background: #374151;
  color: #e5e7eb;
}

.monitor-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 0.75rem;
}

/* Monitor Selector Modal */
.monitor-selector-modal {
  background: var(--color-bg-primary, #fff);
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dark .monitor-selector-modal {
  background: var(--color-bg-primary, #1f2937);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.dark .modal-header {
  border-bottom-color: var(--color-border, #374151);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  padding: 4px;
  font-size: 1.5rem;
}

.modal-close:hover {
  color: var(--color-text-primary);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  max-height: 400px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.dark .modal-footer {
  border-top-color: var(--color-border, #374151);
}

.monitor-selector-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.monitor-selector-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f1f5f9;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  color: #0f172a;
}

.dark .monitor-selector-item {
  background: #374151;
  color: #e5e7eb;
}

.monitor-selector-item:hover {
  background: #e2e8f0;
}

.dark .monitor-selector-item:hover {
  background: #4b5563;
}

.monitor-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary, #10b981);
}

.monitor-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.monitor-info .monitor-name {
  font-weight: 500;
}

.monitor-type {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  text-transform: uppercase;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #10b981);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
