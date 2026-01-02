<script setup lang="ts">
const toast = useToast()
const isExporting = ref(false)
const isImporting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const importFile = ref<File | null>(null)
const importOptions = ref({
  overwrite: false,
  importMonitors: true,
  importNotifications: true,
  importStatusPages: true,
  importMaintenances: true,
  importProxies: true,
  importDockerHosts: true
})

async function exportBackup() {
  isExporting.value = true
  try {
    const data = await $fetch('/api/v1/backup/export', { method: 'GET' })
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `uptime-kuma-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.add({ title: 'Success', description: 'Backup exported', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to export', color: 'error' })
  } finally {
    isExporting.value = false
  }
}

function selectFile() { fileInput.value?.click() }

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) importFile.value = target.files[0]
}

async function importBackup() {
  if (!importFile.value) {
    toast.add({ title: 'Error', description: 'Please select a backup file', color: 'error' })
    return
  }
  isImporting.value = true
  try {
    const fileContent = await importFile.value.text()
    const backupData = JSON.parse(fileContent)
    await $fetch('/api/v1/backup/import', { method: 'POST', body: { data: backupData, options: importOptions.value } })
    toast.add({ title: 'Success', description: 'Backup imported', color: 'success' })
    importFile.value = null
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to import', color: 'error' })
  } finally {
    isImporting.value = false
  }
}

function clearImportFile() {
  importFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <!-- Export Section -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Export Backup</h5>
      <p class="text-gray-400 mb-4">Export all your monitors, notifications, status pages, and settings to a JSON file.</p>
      <div class="alert alert-info mb-4">
        The backup file will include: Monitors, Notifications, Status Pages, Maintenances, Proxies, Docker Hosts
      </div>
      <button class="btn btn-primary" :disabled="isExporting" @click="exportBackup">
        {{ isExporting ? 'Exporting...' : 'Export Backup' }}
      </button>
    </div>

    <!-- Import Section -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Import Backup</h5>
      <p class="text-gray-400 mb-4">Restore your data from a previously exported backup file.</p>
      
      <input ref="fileInput" type="file" accept=".json" class="hidden" @change="handleFileSelect" />
      
      <div v-if="!importFile" class="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-500 transition-colors" @click="selectFile">
        <p class="text-gray-400">Click to select a backup file (.json)</p>
      </div>
      
      <div v-else class="p-4 bg-gray-700 rounded-lg mb-4">
        <div class="flex justify-between items-center">
          <span class="text-white">{{ importFile.name }}</span>
          <button class="text-red-400 hover:text-red-300" @click="clearImportFile">Remove</button>
        </div>
      </div>

      <div v-if="importFile" class="space-y-3 mb-4">
        <h6 class="text-white font-medium">Import Options</h6>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="importOptions.overwrite" type="checkbox" />
          <span class="text-gray-300">Overwrite existing data</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="importOptions.importMonitors" type="checkbox" />
          <span class="text-gray-300">Import Monitors</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="importOptions.importNotifications" type="checkbox" />
          <span class="text-gray-300">Import Notifications</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="importOptions.importStatusPages" type="checkbox" />
          <span class="text-gray-300">Import Status Pages</span>
        </label>
      </div>

      <button v-if="importFile" class="btn btn-primary" :disabled="isImporting" @click="importBackup">
        {{ isImporting ? 'Importing...' : 'Import Backup' }}
      </button>
    </div>
  </div>
</template>
