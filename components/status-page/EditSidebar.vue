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

      <!-- Items Per Page -->
      <div class="form-group">
        <label for="items-per-page" class="form-label">Items Per Page</label>
        <select
          id="items-per-page"
          v-model.number="localConfig.perPage"
          class="form-select"
        >
          <option :value="5">5</option>
          <option :value="10">10</option>
          <option :value="15">15</option>
          <option :value="20">20</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
        </select>
        <div class="form-text">
          Number of monitors displayed per page
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

      <!-- Groups Management Section -->
      <div class="groups-section">
        <h4 class="section-header">
          <span>Groups & Monitors</span>
          <button
            type="button"
            class="btn-icon-add"
            @click="emit('addGroup')"
            title="Add new group"
          >
            <UIcon name="i-heroicons-plus-circle" />
          </button>
        </h4>
        
        <div v-if="!groups || groups.length === 0" class="empty-groups">
          No groups yet. Click + to add one.
        </div>
        
        <div v-else class="groups-list">
          <div
            v-for="(group, groupIndex) in groups"
            :key="group.id"
            class="group-card"
          >
            <div class="group-header">
              <input
                :value="group.name"
                class="group-name-input"
                @input="handleGroupNameChange(group.id, ($event.target as HTMLInputElement).value)"
                @blur="emit('renameGroup', group.id, group.name)"
              />
              <button
                type="button"
                class="btn-icon-remove-small"
                @click="emit('removeGroup', groupIndex)"
                title="Remove group"
              >
                <UIcon name="i-heroicons-x-mark" />
              </button>
            </div>
            
            <div class="monitors-in-group">
              <div v-if="!group.monitorList || group.monitorList.length === 0" class="empty-monitors-small">
                No monitors
              </div>
              <div
                v-for="(monitor, monitorIndex) in group.monitorList"
                :key="monitor.id"
                class="monitor-chip"
              >
                <span class="monitor-chip-name">{{ monitor.name }}</span>
                <button
                  type="button"
                  class="monitor-chip-remove"
                  @click="emit('removeMonitor', groupIndex, monitorIndex)"
                  title="Remove monitor"
                >
                  <UIcon name="i-heroicons-x-mark" class="w-3 h-3" />
                </button>
              </div>
            </div>
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

interface PublicGroup {
  id: number
  name: string
  weight?: number
  monitorList: { id: number; name: string }[]
}

const props = defineProps<{
  modelValue: boolean
  config: StatusPageConfig | null
  groups?: PublicGroup[]
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'save': [config: StatusPageConfig]
  'discard': []
  'delete': []
  'addGroup': []
  'removeGroup': [groupIndex: number]
  'renameGroup': [groupId: number, name: string]
  'removeMonitor': [groupIndex: number, monitorIndex: number]
}>()

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

// Group name change handler
function handleGroupNameChange(groupId: number, name: string) {
  // Emit immediately for real-time updates
  emit('renameGroup', groupId, name)
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
  background: var(--uk-bg-surface);
  border-right: 1px solid var(--uk-border);
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
  z-index: 100;
  color: var(--uk-text);
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
  border-bottom: 1px solid var(--uk-border);
  color: var(--uk-text);
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--uk-text);
}

.form-control,
.form-select {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.875rem;
  border: 1px solid var(--uk-border-strong);
  border-radius: 6px;
  background: var(--uk-bg-surface);
  color: var(--uk-text);
}

.form-control:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-primary, #10b981);
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.form-text {
  font-size: 0.75rem;
  color: var(--uk-text-muted);
  margin-top: 4px;
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
  color: var(--uk-text);
}

.input-group {
  display: flex;
}

.input-group-text {
  padding: 8px 12px;
  font-size: 0.875rem;
  background: var(--uk-bg-sunken);
  border: 1px solid var(--uk-border-strong);
  border-right: none;
  border-radius: 6px 0 0 6px;
  color: var(--uk-text-secondary);
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
  color: var(--uk-primary-fg, #059669);
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
  color: var(--uk-status-down, #ef4444);
  cursor: pointer;
  padding: 4px;
  font-size: 1.25rem;
}

.btn-icon-remove:hover {
  color: var(--uk-red-700, #dc2626);
}

.css-editor {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
}

.danger-zone {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--uk-status-down, var(--uk-status-down));
}

.danger-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--uk-status-down-fg);
  margin-bottom: 12px;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--uk-border);
  display: flex;
  gap: 12px;
  background: var(--uk-bg-surface);
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
  background: var(--uk-primary-fg, #059669);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--uk-border-strong);
  color: var(--uk-text);
}

.btn-outline:hover {
  background: var(--uk-bg-active);
}

.btn-danger {
  background: var(--uk-status-down, #ef4444);
  color: white;
  border: none;
}

.btn-danger:hover {
  background: var(--uk-red-700, #dc2626);
}

.me-1 {
  margin-right: 4px;
}

/* Monitors Section */
.monitors-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--uk-border);
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--uk-text);
}

.empty-monitors {
  text-align: center;
  padding: 16px;
  background: var(--uk-bg-sunken);
  border-radius: 8px;
  color: var(--uk-text-muted);
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
  background: var(--uk-bg-sunken);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--uk-text);
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
  background: var(--uk-bg-surface, #fff);
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--uk-border, var(--uk-border));
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
}

.modal-close {
  background: none;
  border: none;
  color: var(--uk-text-muted, #6b7280);
  cursor: pointer;
  padding: 4px;
  font-size: 1.5rem;
}

.modal-close:hover {
  color: var(--uk-text);
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
  border-top: 1px solid var(--uk-border, var(--uk-border));
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
  background: var(--uk-bg-sunken);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  color: var(--uk-text);
}

.monitor-selector-item:hover {
  background: var(--uk-bg-active);
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
  color: var(--uk-text-muted, #6b7280);
  text-transform: uppercase;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--uk-border, var(--uk-border));
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

/* Groups Section Styles */
.groups-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--uk-border);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--uk-text);
}

.empty-groups {
  text-align: center;
  padding: 16px;
  background: var(--uk-bg-sunken);
  border-radius: 8px;
  color: var(--uk-text-muted);
  font-size: 0.875rem;
}

.groups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-card {
  background: var(--uk-bg-sunken);
  border: 1px solid var(--uk-border);
  border-radius: 8px;
  padding: 10px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.group-name-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid var(--uk-border-strong);
  border-radius: 4px;
  background: var(--uk-bg-surface);
  color: var(--uk-text);
}

.group-name-input:focus {
  outline: none;
  border-color: var(--color-primary, #10b981);
}

.btn-icon-remove-small {
  background: none;
  border: none;
  color: var(--uk-text-muted);
  cursor: pointer;
  padding: 4px;
  font-size: 1rem;
  transition: color 0.2s;
}

.btn-icon-remove-small:hover {
  color: var(--uk-status-down-fg);
}

.monitors-in-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-monitors-small {
  font-size: 0.75rem;
  color: var(--uk-text-muted);
  font-style: italic;
}

.monitor-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--uk-status-maintenance) var(--uk-subtle-mix), transparent);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--uk-status-maintenance-fg);
}

.monitor-chip-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monitor-chip-remove {
  background: none;
  border: none;
  color: var(--uk-status-maintenance-fg);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.monitor-chip-remove:hover {
  color: var(--uk-status-down-fg);
}
</style>
