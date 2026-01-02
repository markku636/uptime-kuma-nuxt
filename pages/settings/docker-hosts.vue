<script setup lang="ts">
const toast = useToast()
const dockerHosts = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingHost = ref<any>(null)
const form = ref({ name: '', dockerType: 'socket', dockerDaemon: '/var/run/docker.sock', dockerHost: '', dockerPort: 2375, dockerTLS: false })

onMounted(async () => { await fetchHosts() })

async function fetchHosts() {
  loading.value = true
  try { dockerHosts.value = await $fetch('/api/v1/docker-hosts') as any[] }
  catch (error: any) { toast.add({ title: 'Error', description: error.data?.message || 'Failed to load', color: 'error' }) }
  finally { loading.value = false }
}

function openAddForm() {
  editingHost.value = null
  form.value = { name: '', dockerType: 'socket', dockerDaemon: '/var/run/docker.sock', dockerHost: '', dockerPort: 2375, dockerTLS: false }
  showForm.value = true
}

function openEditForm(host: any) {
  editingHost.value = host
  form.value = { ...host }
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingHost.value) {
      await $fetch(`/api/v1/docker-hosts/${editingHost.value.id}`, { method: 'PUT', body: form.value })
      toast.add({ title: 'Success', description: 'Docker host updated', color: 'success' })
    } else {
      await $fetch('/api/v1/docker-hosts', { method: 'POST', body: form.value })
      toast.add({ title: 'Success', description: 'Docker host created', color: 'success' })
    }
    showForm.value = false
    await fetchHosts()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

async function deleteHost(id: number) {
  if (!confirm('Delete this Docker host?')) return
  try {
    await $fetch(`/api/v1/docker-hosts/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Docker host deleted', color: 'success' })
    await fetchHosts()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-white">Docker Hosts</h4>
      <button class="btn btn-primary" @click="openAddForm">Add Docker Host</button>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

    <div v-else-if="dockerHosts.length === 0" class="section-card text-center py-8">
      <p class="text-gray-400 mb-4">No Docker hosts configured yet.</p>
      <button class="btn btn-primary" @click="openAddForm">Add Your First Docker Host</button>
    </div>

    <div v-else class="section-card">
      <table class="table">
        <thead><tr><th>Name</th><th>Type</th><th>Connection</th><th class="text-right">Actions</th></tr></thead>
        <tbody>
          <tr v-for="host in dockerHosts" :key="host.id">
            <td>{{ host.name }}</td>
            <td class="capitalize">{{ host.dockerType }}</td>
            <td>{{ host.dockerType === 'socket' ? host.dockerDaemon : `${host.dockerHost}:${host.dockerPort}` }}</td>
            <td class="text-right space-x-2">
              <button class="btn btn-secondary" @click="openEditForm(host)">Edit</button>
              <button class="btn btn-danger" @click="deleteHost(host.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">{{ editingHost ? 'Edit' : 'Add' }} Docker Host</h3>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input v-model="form.name" type="text" class="input-field" placeholder="My Docker Host" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Connection Type</label>
            <select v-model="form.dockerType" class="select-field">
              <option value="socket">Socket</option>
              <option value="tcp">TCP</option>
            </select>
          </div>
          <div v-if="form.dockerType === 'socket'">
            <label class="block text-sm font-medium text-gray-300 mb-2">Socket Path</label>
            <input v-model="form.dockerDaemon" type="text" class="input-field" placeholder="/var/run/docker.sock" />
          </div>
          <template v-else>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Host</label>
              <input v-model="form.dockerHost" type="text" class="input-field" placeholder="192.168.1.100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Port</label>
              <input v-model.number="form.dockerPort" type="number" class="input-field" />
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.dockerTLS" type="checkbox" />
              <span class="text-gray-300">Use TLS</span>
            </label>
          </template>
          <div class="flex gap-3 pt-4">
            <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">{{ editingHost ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
