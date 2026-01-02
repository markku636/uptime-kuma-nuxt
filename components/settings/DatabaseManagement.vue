<template>
  <div class="shadow-box">
    <h4 class="mb-4">Database Management</h4>

    <!-- Database Info -->
    <div class="info-box mb-4">
      <h5 class="mb-3">Database Information</h5>
      <div class="row">
        <div class="col-6 mb-2">
          <span class="text-muted">Type:</span>
          <code class="ms-2">{{ dbInfo.type }}</code>
        </div>
        <div class="col-6 mb-2">
          <span class="text-muted">Size:</span>
          <code class="ms-2">{{ formatSize(dbInfo.size) }}</code>
        </div>
        <div class="col-6 mb-2">
          <span class="text-muted">Monitors:</span>
          <code class="ms-2">{{ dbInfo.monitors }}</code>
        </div>
        <div class="col-6 mb-2">
          <span class="text-muted">Heartbeats:</span>
          <code class="ms-2">{{ formatNumber(dbInfo.heartbeats) }}</code>
        </div>
      </div>
    </div>

    <!-- Shrink Database -->
    <div class="mb-4">
      <h5>Shrink Database</h5>
      <p class="text-muted small">
        Reclaim disk space by removing unused space from the database.
      </p>
      <button class="btn btn-outline-secondary" :disabled="isShrinking" @click="shrinkDatabase">
        <span v-if="isShrinking" class="spinner-border spinner-border-sm me-1"></span>
        <i v-else class="fas fa-compress me-1"></i>
        Shrink Database
      </button>
    </div>

    <!-- Export Data -->
    <div class="mb-4">
      <h5>Export Data</h5>
      <p class="text-muted small">
        Export all monitors and settings as a JSON backup file.
      </p>
      <button class="btn btn-outline-secondary" :disabled="isExporting" @click="exportData">
        <span v-if="isExporting" class="spinner-border spinner-border-sm me-1"></span>
        <i v-else class="fas fa-download me-1"></i>
        Export
      </button>
    </div>

    <!-- Import Data -->
    <div class="mb-4">
      <h5>Import Data</h5>
      <p class="text-muted small">
        Import monitors and settings from a backup file.
      </p>
      <div class="d-flex align-items-center gap-2">
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="d-none"
          @change="handleFileSelect"
        />
        <button class="btn btn-outline-secondary" :disabled="isImporting" @click="triggerFileInput">
          <span v-if="isImporting" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="fas fa-upload me-1"></i>
          Import
        </button>
        <span v-if="selectedFile" class="text-muted small">
          {{ selectedFile.name }}
        </span>
      </div>
    </div>

    <!-- Danger Zone -->
    <div class="danger-zone">
      <h5 class="text-danger mb-3">
        <i class="fas fa-exclamation-triangle me-1"></i> Danger Zone
      </h5>

      <!-- Clear Heartbeats -->
      <div class="danger-item mb-3">
        <h6>Clear All Heartbeats</h6>
        <p class="text-muted small mb-2">
          Delete all heartbeat history. Monitor configurations will be kept.
        </p>
        <div class="input-group" style="max-width: 300px;">
          <input
            v-model="clearHeartbeatsConfirm"
            type="text"
            class="form-control"
            placeholder='Type "DELETE" to confirm'
          />
          <button
            class="btn btn-outline-danger"
            :disabled="clearHeartbeatsConfirm !== 'DELETE'"
            @click="clearHeartbeats"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Clear Statistics -->
      <div class="danger-item mb-3">
        <h6>Clear All Statistics</h6>
        <p class="text-muted small mb-2">
          Delete all uptime statistics and daily aggregates.
        </p>
        <div class="input-group" style="max-width: 300px;">
          <input
            v-model="clearStatsConfirm"
            type="text"
            class="form-control"
            placeholder='Type "DELETE" to confirm'
          />
          <button
            class="btn btn-outline-danger"
            :disabled="clearStatsConfirm !== 'DELETE'"
            @click="clearStatistics"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- Clear All Data -->
      <div class="danger-item danger-critical">
        <h6 class="text-danger">Clear All Data</h6>
        <p class="text-muted small mb-2">
          Delete ALL data including monitors, notifications, and settings. This cannot be undone!
        </p>
        <div class="input-group" style="max-width: 350px;">
          <input
            v-model="clearAllConfirm"
            type="text"
            class="form-control"
            placeholder='Type "DELETE ALL" to confirm'
          />
          <button
            class="btn btn-danger"
            :disabled="clearAllConfirm !== 'DELETE ALL'"
            @click="clearAllData"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface DbInfo {
  type: string
  size: number
  monitors: number
  heartbeats: number
}

const dbInfo = ref<DbInfo>({
  type: 'PostgreSQL',
  size: 0,
  monitors: 0,
  heartbeats: 0
})

const isShrinking = ref(false)
const isExporting = ref(false)
const isImporting = ref(false)

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)

const clearHeartbeatsConfirm = ref('')
const clearStatsConfirm = ref('')
const clearAllConfirm = ref('')

// Fetch database info
onMounted(async () => {
  try {
    const info = await $fetch<DbInfo>('/api/v1/settings/database-info')
    dbInfo.value = info
  } catch (e) {
    // Use defaults
  }
})

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

async function shrinkDatabase() {
  isShrinking.value = true
  try {
    await $fetch('/api/v1/maintenance/shrink-database', { method: 'POST' })
    // Refresh db info
    const info = await $fetch<DbInfo>('/api/v1/settings/database-info')
    dbInfo.value = info
  } catch (e) {
    console.error('Failed to shrink database:', e)
  } finally {
    isShrinking.value = false
  }
}

async function exportData() {
  isExporting.value = true
  try {
    const blob = await $fetch('/api/v1/settings/export', {
      responseType: 'blob'
    })
    
    const url = URL.createObjectURL(blob as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uptime-kuma-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('Failed to export data:', e)
  } finally {
    isExporting.value = false
  }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    selectedFile.value = file
    importData(file)
  }
}

async function importData(file: File) {
  isImporting.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    
    await $fetch('/api/v1/settings/import', {
      method: 'POST',
      body: formData
    })
    
    // Refresh page to show imported data
    window.location.reload()
  } catch (e) {
    console.error('Failed to import data:', e)
  } finally {
    isImporting.value = false
    selectedFile.value = null
  }
}

async function clearHeartbeats() {
  if (clearHeartbeatsConfirm.value !== 'DELETE') return
  
  try {
    await $fetch('/api/v1/maintenance/clear-heartbeats', { method: 'POST' })
    clearHeartbeatsConfirm.value = ''
    // Refresh db info
    const info = await $fetch<DbInfo>('/api/v1/settings/database-info')
    dbInfo.value = info
  } catch (e) {
    console.error('Failed to clear heartbeats:', e)
  }
}

async function clearStatistics() {
  if (clearStatsConfirm.value !== 'DELETE') return
  
  try {
    await $fetch('/api/v1/maintenance/clear-statistics', { method: 'POST' })
    clearStatsConfirm.value = ''
  } catch (e) {
    console.error('Failed to clear statistics:', e)
  }
}

async function clearAllData() {
  if (clearAllConfirm.value !== 'DELETE ALL') return
  
  const confirmed = confirm('Are you absolutely sure? This will delete everything!')
  if (!confirmed) return
  
  try {
    await $fetch('/api/v1/maintenance/clear-all', { method: 'POST' })
    clearAllConfirm.value = ''
    window.location.reload()
  } catch (e) {
    console.error('Failed to clear all data:', e)
  }
}
</script>

<style scoped>
.shadow-box {
  background: white;
  border-radius: 10px;
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.dark .shadow-box {
  background: #212529;
}

.info-box {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
}

.dark .info-box {
  background: #2d3238;
}

.danger-zone {
  border-top: 1px solid #dee2e6;
  padding-top: 20px;
  margin-top: 20px;
}

.dark .danger-zone {
  border-color: #373d45;
}

.danger-item {
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  padding: 15px;
}

.dark .danger-item {
  background: rgba(220, 53, 69, 0.1);
  border-color: rgba(220, 53, 69, 0.3);
}

.danger-critical {
  background: #fef2f2;
}

.dark .danger-critical {
  background: rgba(220, 53, 69, 0.15);
}
</style>
