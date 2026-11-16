<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const nodes = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingNode = ref<any>(null)
const confirmDeleteNode = ref<any>(null)
const showDeleteConfirm = ref(false)

const form = ref({
  nodeId: '',
  nodeName: '',
  host: '',
  location: '',
  isPrimary: false
})

// TODO: Get current node ID from server info
const currentNodeId = ref<string | null>(null)

onMounted(async () => {
  await fetchNodes()
})

async function fetchNodes() {
  loading.value = true
  try {
    const response = await $fetch('/api/v1/nodes') as any
    nodes.value = response || []
  } catch (error: any) {
    toast.add({ 
      title: 'Error', 
      description: error.data?.message || 'Failed to load nodes', 
      color: 'error' 
    })
  } finally {
    loading.value = false
  }
}

function openAddForm() {
  editingNode.value = null
  form.value = {
    nodeId: '',
    nodeName: '',
    host: '',
    location: '',
    isPrimary: false
  }
  showForm.value = true
}

function openEditForm(node: any) {
  editingNode.value = node
  form.value = {
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    host: node.host || '',
    location: node.location || '',
    isPrimary: node.isPrimary || false
  }
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingNode.value) {
      await $fetch(`/api/v1/nodes/${editingNode.value.id}`, { 
        method: 'PUT', 
        body: form.value 
      })
      toast.add({ 
        title: 'Success', 
        description: 'Node updated successfully', 
        color: 'success' 
      })
    } else {
      await $fetch('/api/v1/nodes', { 
        method: 'POST', 
        body: form.value 
      })
      toast.add({ 
        title: 'Success', 
        description: 'Node created successfully', 
        color: 'success' 
      })
    }
    showForm.value = false
    await fetchNodes()
  } catch (error: any) {
    toast.add({ 
      title: 'Error', 
      description: error.data?.message || 'Failed to save node', 
      color: 'error' 
    })
  }
}

function confirmDelete(node: any) {
  confirmDeleteNode.value = node
  showDeleteConfirm.value = true
}

async function deleteNode() {
  if (!confirmDeleteNode.value) return
  
  try {
    await $fetch(`/api/v1/nodes/${confirmDeleteNode.value.id}`, { method: 'DELETE' })
    toast.add({ 
      title: 'Success', 
      description: 'Node deleted successfully', 
      color: 'success' 
    })
    showDeleteConfirm.value = false
    confirmDeleteNode.value = null
    await fetchNodes()
  } catch (error: any) {
    toast.add({ 
      title: 'Error', 
      description: error.data?.message || 'Failed to delete node', 
      color: 'error' 
    })
  }
}

function isCurrentNode(nodeId: string) {
  return currentNodeId.value === nodeId
}

function getStatusClass(status: string) {
  switch (status) {
    case 'online':
      return 'bg-up'
    case 'offline':
      return 'bg-down'
    default:
      return 'bg-unknown'
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'online':
      return 'Online'
    case 'offline':
      return 'Offline'
    default:
      return 'Unknown'
  }
}

function formatDateTime(dateTime: string | null) {
  if (!dateTime) return '-'
  return new Date(dateTime).toLocaleString()
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-highlighted">Cluster Nodes</h4>
      <button class="btn btn-primary" @click="openAddForm">
        <span class="i-heroicons-plus mr-1"></span>
        Add Node
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-8 text-toned">
      Loading...
    </div>

    <!-- Empty State -->
    <div v-else-if="nodes.length === 0" class="section-card text-center py-8">
      <p class="text-toned mb-4">No nodes configured yet.</p>
      <p class="text-muted text-sm mb-4">
        Node management allows you to organize monitors across multiple Uptime Kuma instances.
      </p>
      <button class="btn btn-primary" @click="openAddForm">
        Add Your First Node
      </button>
    </div>

    <!-- Node List -->
    <div v-else class="space-y-4">
      <div 
        v-for="node in nodes" 
        :key="node.id"
        class="section-card"
      >
        <div class="flex items-center justify-between">
          <!-- Left: Status + Info -->
          <div class="flex items-center gap-4">
            <!-- Status Circle -->
            <div 
              class="w-6 h-6 rounded-full flex-shrink-0" 
              :class="getStatusClass(node.status)"
            ></div>
            
            <!-- Node Info -->
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg font-semibold text-highlighted">
                  {{ node.nodeName }}
                </span>
                <span class="text-sm text-muted font-mono bg-accented px-2 py-0.5 rounded">
                  {{ node.nodeId }}
                </span>
                <span 
                  v-if="node.isPrimary" 
                  class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full"
                >
                  Primary
                </span>
                <span 
                  v-if="isCurrentNode(node.nodeId)" 
                  class="bg-up text-white text-xs px-2 py-0.5 rounded-full"
                >
                  Current
                </span>
              </div>
              
              <div class="flex items-center gap-4 text-sm text-toned">
                <span class="flex items-center gap-1">
                  <span class="i-heroicons-signal text-xs"></span>
                  {{ getStatusText(node.status) }}
                </span>
                <span v-if="node.host" class="flex items-center gap-1">
                  <span class="i-heroicons-server text-xs"></span>
                  {{ node.host }}
                </span>
                <span v-if="node.lastSeen" class="flex items-center gap-1">
                  <span class="i-heroicons-clock text-xs"></span>
                  {{ formatDateTime(node.lastSeen) }}
                </span>
                <span class="flex items-center gap-1">
                  <span class="i-heroicons-calendar text-xs"></span>
                  {{ formatDateTime(node.createdAt) }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Right: Actions -->
          <div class="flex items-center gap-2">
            <button 
              class="btn btn-secondary"
              @click="openEditForm(node)"
            >
              Edit
            </button>
            <button 
              class="btn btn-danger"
              :disabled="isCurrentNode(node.nodeId)"
              @click="confirmDelete(node)"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Info Text -->
    <div class="text-center mt-6 text-sm text-muted">
      Node management allows you to organize monitors across multiple Uptime Kuma instances.
    </div>

    <!-- Add/Edit Form Modal -->
    <div 
      v-if="showForm" 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-default rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-highlighted mb-4">
          {{ editingNode ? 'Edit Node' : 'Add Node' }}
        </h3>
        
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Node ID -->
          <div>
            <label class="block text-sm font-medium text-default mb-2">
              Node ID *
            </label>
            <input
              v-model="form.nodeId"
              type="text"
              class="input-field"
              :disabled="!!editingNode"
              required
              placeholder="node-1"
            />
            <p class="text-sm text-muted mt-1">
              Unique identifier for this node (cannot be changed after creation)
            </p>
          </div>
          
          <!-- Node Name -->
          <div>
            <label class="block text-sm font-medium text-default mb-2">
              Node Name *
            </label>
            <input
              v-model="form.nodeName"
              type="text"
              class="input-field"
              required
              placeholder="Primary Server"
            />
            <p class="text-sm text-muted mt-1">
              Friendly name for this node
            </p>
          </div>
          
          <!-- Host -->
          <div>
            <label class="block text-sm font-medium text-default mb-2">
              Host
            </label>
            <input
              v-model="form.host"
              type="text"
              class="input-field"
              placeholder="192.168.1.100 or example.com"
            />
            <p class="text-sm text-muted mt-1">
              Optional host address (IP or hostname)
            </p>
          </div>
          
          <!-- Location -->
          <div>
            <label class="block text-sm font-medium text-default mb-2">
              Location
            </label>
            <input
              v-model="form.location"
              type="text"
              class="input-field"
              placeholder="US East, Tokyo, etc."
            />
            <p class="text-sm text-muted mt-1">
              Optional location description
            </p>
          </div>
          
          <!-- Is Primary -->
          <div class="flex items-center gap-2">
            <input
              v-model="form.isPrimary"
              type="checkbox"
              id="isPrimary"
              class="form-checkbox rounded text-up-fg"
            />
            <label for="isPrimary" class="text-default">
              Primary Node
            </label>
          </div>
          <p class="text-sm text-muted">
            Only one node can be set as primary. Setting this will make other nodes secondary.
          </p>
          
          <!-- Buttons -->
          <div class="flex justify-end gap-2 pt-4">
            <button 
              type="button" 
              class="btn btn-secondary" 
              @click="showForm = false"
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {{ editingNode ? 'Update' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div 
      v-if="showDeleteConfirm" 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div class="bg-default rounded-xl p-6 max-w-sm w-full mx-4">
        <h3 class="text-xl font-bold text-highlighted mb-4">Delete Node</h3>
        <p class="text-default mb-6">
          Are you sure you want to delete this node?
        </p>
        <div class="flex justify-end gap-2">
          <button 
            class="btn btn-secondary" 
            @click="showDeleteConfirm = false"
          >
            Cancel
          </button>
          <button 
            class="btn btn-danger" 
            @click="deleteNode"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
