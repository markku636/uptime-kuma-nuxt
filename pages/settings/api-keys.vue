<script setup lang="ts">
const toast = useToast()
const apiKeys = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const newKeyName = ref('')
const newKeyValue = ref('')

onMounted(async () => { await fetchKeys() })

async function fetchKeys() {
  loading.value = true
  try { apiKeys.value = await $fetch('/api/v1/api-keys') as any[] }
  catch (error: any) { toast.add({ title: 'Error', description: error.data?.message || 'Failed to load', color: 'error' }) }
  finally { loading.value = false }
}

async function generateKey() {
  if (!newKeyName.value) {
    toast.add({ title: 'Error', description: 'Please enter a name', color: 'error' })
    return
  }
  try {
    const result = await $fetch('/api/v1/api-keys', { method: 'POST', body: { name: newKeyName.value } }) as any
    newKeyValue.value = result.key
    toast.add({ title: 'Success', description: 'API key generated', color: 'success' })
    await fetchKeys()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to generate', color: 'error' })
  }
}

async function deleteKey(id: number) {
  if (!confirm('Delete this API key?')) return
  try {
    await $fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'API key deleted', color: 'success' })
    await fetchKeys()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied', description: 'Copied to clipboard', color: 'success' })
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-white">API Keys</h4>
      <button class="btn btn-primary" @click="showForm = true">Generate Key</button>
    </div>

    <div class="alert alert-info mb-6">
      API keys allow external applications to access the Uptime Kuma API. Keep your keys secure.
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

    <div v-else-if="apiKeys.length === 0" class="section-card text-center py-8">
      <p class="text-gray-400 mb-4">No API keys generated yet.</p>
      <button class="btn btn-primary" @click="showForm = true">Generate Your First Key</button>
    </div>

    <div v-else class="section-card">
      <div class="space-y-3">
        <div v-for="key in apiKeys" :key="key.id" class="flex justify-between items-center p-4 bg-gray-700 rounded-lg">
          <div>
            <span class="font-medium text-white">{{ key.name }}</span>
            <span class="text-sm text-gray-400 ml-2">Created: {{ new Date(key.createdAt).toLocaleDateString() }}</span>
          </div>
          <button class="btn btn-danger" @click="deleteKey(key.id)">Delete</button>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">Generate API Key</h3>
        <div v-if="newKeyValue">
          <div class="alert alert-warning mb-4">This key will only be shown once!</div>
          <div class="flex gap-2 mb-4">
            <input :value="newKeyValue" type="text" class="input-field flex-1 font-mono text-sm" readonly />
            <button class="btn btn-secondary" @click="copyToClipboard(newKeyValue)">Copy</button>
          </div>
          <button class="btn btn-primary w-full" @click="showForm = false; newKeyValue = ''; newKeyName = ''">Done</button>
        </div>
        <form v-else @submit.prevent="generateKey" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Key Name</label>
            <input v-model="newKeyName" type="text" class="input-field" placeholder="e.g., CI/CD Pipeline" />
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">Generate</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
