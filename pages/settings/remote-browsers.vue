<script setup lang="ts">
const toast = useToast()
const browsers = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingBrowser = ref<any>(null)
const form = ref({ name: '', url: '' })

onMounted(async () => { await fetchBrowsers() })

async function fetchBrowsers() {
  loading.value = true
  try {
    const response = await $fetch('/api/v1/remote-browsers') as any
    // Handle both { ok, data } format and direct array format
    browsers.value = response?.data || response || []
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to load', color: 'error' })
  } finally {
    loading.value = false
  }
}

function openAddForm() {
  editingBrowser.value = null
  form.value = { name: '', url: '' }
  showForm.value = true
}

function openEditForm(browser: any) {
  editingBrowser.value = browser
  form.value = { name: browser.name, url: browser.url }
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingBrowser.value) {
      await $fetch(`/api/v1/remote-browsers/${editingBrowser.value.id}`, { method: 'PUT', body: form.value })
      toast.add({ title: 'Success', description: 'Browser updated', color: 'success' })
    } else {
      await $fetch('/api/v1/remote-browsers', { method: 'POST', body: form.value })
      toast.add({ title: 'Success', description: 'Browser added', color: 'success' })
    }
    showForm.value = false
    await fetchBrowsers()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

async function deleteBrowser(id: number) {
  if (!confirm('Delete this remote browser?')) return
  try {
    await $fetch(`/api/v1/remote-browsers/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Browser deleted', color: 'success' })
    await fetchBrowsers()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-white">Remote Browsers</h4>
      <button class="btn btn-primary" @click="openAddForm">Add Browser</button>
    </div>

    <div class="alert alert-info mb-6">
      Remote browsers allow you to monitor websites using a headless Chrome browser for more accurate monitoring.
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

    <div v-else-if="browsers.length === 0" class="section-card text-center py-8">
      <p class="text-gray-400 mb-4">No remote browsers configured yet.</p>
      <button class="btn btn-primary" @click="openAddForm">Add Your First Browser</button>
    </div>

    <div v-else class="section-card">
      <table class="table">
        <thead><tr><th>Name</th><th>URL</th><th class="text-right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="browser in browsers" :key="browser.id">
            <td>{{ browser.name }}</td>
            <td>{{ browser.url }}</td>
            <td class="text-right space-x-2">
              <button class="btn btn-secondary" @click="openEditForm(browser)">Edit</button>
              <button class="btn btn-danger" @click="deleteBrowser(browser.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">{{ editingBrowser ? 'Edit' : 'Add' }} Remote Browser</h3>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input v-model="form.name" type="text" class="input-field" placeholder="My Browser" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">WebSocket URL</label>
            <input v-model="form.url" type="text" class="input-field" placeholder="ws://localhost:3000" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">{{ editingBrowser ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
