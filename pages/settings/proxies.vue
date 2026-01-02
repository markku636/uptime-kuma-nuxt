<script setup lang="ts">
const toast = useToast()
const proxies = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingProxy = ref<any>(null)
const form = ref({ protocol: 'http', host: '', port: 8080, auth: false, username: '', password: '', active: true })

onMounted(async () => { await fetchProxies() })

async function fetchProxies() {
  loading.value = true
  try { proxies.value = await $fetch('/api/v1/proxies') as any[] }
  catch (error: any) { toast.add({ title: 'Error', description: error.data?.message || 'Failed to load', color: 'error' }) }
  finally { loading.value = false }
}

function openAddForm() {
  editingProxy.value = null
  form.value = { protocol: 'http', host: '', port: 8080, auth: false, username: '', password: '', active: true }
  showForm.value = true
}

function openEditForm(proxy: any) {
  editingProxy.value = proxy
  form.value = { ...proxy }
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingProxy.value) {
      await $fetch(`/api/v1/proxies/${editingProxy.value.id}`, { method: 'PUT', body: form.value })
      toast.add({ title: 'Success', description: 'Proxy updated', color: 'success' })
    } else {
      await $fetch('/api/v1/proxies', { method: 'POST', body: form.value })
      toast.add({ title: 'Success', description: 'Proxy created', color: 'success' })
    }
    showForm.value = false
    await fetchProxies()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

async function deleteProxy(id: number) {
  if (!confirm('Delete this proxy?')) return
  try {
    await $fetch(`/api/v1/proxies/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Proxy deleted', color: 'success' })
    await fetchProxies()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-white">Proxies</h4>
      <button class="btn btn-primary" @click="openAddForm">Add Proxy</button>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

    <div v-else-if="proxies.length === 0" class="section-card text-center py-8">
      <p class="text-gray-400 mb-4">No proxies configured yet.</p>
      <button class="btn btn-primary" @click="openAddForm">Add Your First Proxy</button>
    </div>

    <div v-else class="section-card">
      <table class="table">
        <thead><tr><th>Protocol</th><th>Host</th><th>Port</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="proxy in proxies" :key="proxy.id">
            <td class="uppercase">{{ proxy.protocol }}</td>
            <td>{{ proxy.host }}</td>
            <td>{{ proxy.port }}</td>
            <td><span :class="proxy.active ? 'badge badge-success' : 'badge badge-secondary'">{{ proxy.active ? 'Active' : 'Inactive' }}</span></td>
            <td class="text-right space-x-2">
              <button class="btn btn-secondary" @click="openEditForm(proxy)">Edit</button>
              <button class="btn btn-danger" @click="deleteProxy(proxy.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">{{ editingProxy ? 'Edit' : 'Add' }} Proxy</h3>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Protocol</label>
            <select v-model="form.protocol" class="select-field">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks">SOCKS</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Host</label>
            <input v-model="form.host" type="text" class="input-field" placeholder="proxy.example.com" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
            <input v-model.number="form.port" type="number" class="input-field" />
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.auth" type="checkbox" />
            <span class="text-gray-300">Requires authentication</span>
          </label>
          <template v-if="form.auth">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input v-model="form.username" type="text" class="input-field" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input v-model="form.password" type="password" class="input-field" />
            </div>
          </template>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.active" type="checkbox" />
            <span class="text-gray-300">Active</span>
          </label>
          <div class="flex gap-3 pt-4">
            <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">{{ editingProxy ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
