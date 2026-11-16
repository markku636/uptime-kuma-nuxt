<template>
  <div class="node-selector">
    <!-- Node Button -->
    <UButton
      color="neutral"
      variant="outline"
      size="sm"
      @click="showModal = true"
    >
      <span 
        class="w-2 h-2 rounded-full mr-2" 
        :class="currentNodeOnline ? 'bg-up' : 'bg-unknown'"
      ></span>
      <span class="text-sm">Node: {{ currentNodeDisplay }}</span>
    </UButton>

    <!-- Custom Modal using Teleport -->
    <Teleport to="body">
      <Transition name="modal">
        <div 
          v-if="showModal" 
          class="fixed inset-0 z-[9999] flex items-center justify-center"
          @click.self="showModal = false"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          
          <!-- Modal Content -->
          <div class="relative z-10 w-full max-w-md mx-4 bg-[var(--bg-primary)] rounded-lg shadow-xl border border-[var(--border-color)]">
            <!-- Header -->
            <div class="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <div>
                <h3 class="text-lg font-semibold text-[var(--text-primary)]">Select Node</h3>
                <p class="text-sm text-[var(--text-tertiary)]">Choose which backend node OpenResty should route you to.</p>
              </div>
              <button 
                @click="showModal = false"
                class="p-1 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
              >
                <svg class="w-5 h-5 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <!-- Body -->
            <div class="p-4">
              <div v-if="loading" class="py-8 text-center">
                <svg class="w-6 h-6 animate-spin mx-auto text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p class="text-sm text-[var(--text-tertiary)] mt-2">Loading nodes...</p>
              </div>
              
              <div v-else-if="nodes.length === 0" class="py-8 text-center">
                <svg class="w-8 h-8 mx-auto text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
                <p class="text-[var(--text-secondary)] mt-2">No nodes configured</p>
                <NuxtLink 
                  to="/settings/nodes" 
                  class="text-sm text-up-fg hover:underline" 
                  @click="showModal = false"
                >
                  Add nodes in Settings
                </NuxtLink>
              </div>
              
              <div v-else class="space-y-2">
                <button
                  v-for="node in nodes"
                  :key="node.id"
                  class="w-full flex items-center gap-3 p-3 rounded-lg border transition-all"
                  :class="selectedNodeId === node.nodeId 
                    ? 'border-up/40 bg-up/10' 
                    : 'border-[var(--border-color)] hover:border-up/40 hover:bg-[var(--hover-bg)]'"
                  @click="selectNode(node)"
                >
                  <!-- Status Indicator -->
                  <span 
                    class="w-3 h-3 rounded-full flex-shrink-0" 
                    :class="node.status === 'online' ? 'bg-up' : 'bg-unknown'"
                  ></span>
                  
                  <!-- Node Info -->
                  <div class="flex-1 text-left">
                    <div class="font-medium text-[var(--text-primary)]">{{ node.nodeName || node.nodeId }}</div>
                    <div class="text-xs text-[var(--text-tertiary)]">
                      {{ node.host || node.hostname || node.nodeId }}
                    </div>
                  </div>
                  
                  <!-- Current Badge -->
                  <span 
                    v-if="selectedNodeId === node.nodeId" 
                    class="px-2 py-1 text-xs rounded bg-up text-on-primary"
                  >
                    Current
                  </span>
                  
                  <!-- Monitor Count -->
                  <span class="text-xs text-[var(--text-tertiary)]">
                    Monitors: {{ node.monitorCount || 0 }}
                  </span>
                </button>
              </div>
            </div>
            
            <!-- Footer -->
            <div class="flex items-center justify-between p-4 border-t border-[var(--border-color)]">
              <UButton
                variant="outline"
                color="neutral"
                @click="useAutoMode"
              >
                Use Load Balancer (auto)
              </UButton>
              <UButton
                color="neutral"
                @click="showModal = false"
              >
                Cancel
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
interface Node {
  id: number
  nodeId: string
  nodeName: string
  host?: string
  hostname?: string
  status: string
  monitorCount?: number
}

const toast = useToast()
const showModal = ref(false)
const nodes = ref<Node[]>([])
const loading = ref(false)
const selectedNodeId = ref<string>('auto')

const currentNodeDisplay = computed(() => {
  if (selectedNodeId.value === 'auto') {
    return 'All Nodes'
  }
  const node = nodes.value.find(n => n.nodeId === selectedNodeId.value)
  return node?.nodeName || node?.nodeId || selectedNodeId.value
})

const currentNodeOnline = computed(() => {
  if (selectedNodeId.value === 'auto') {
    return nodes.value.some(n => n.status === 'online')
  }
  const node = nodes.value.find(n => n.nodeId === selectedNodeId.value)
  return node?.status === 'online'
})

// 取得節點列表
async function fetchNodes() {
  loading.value = true
  try {
    const response = await $fetch<Node[]>('/api/v1/nodes')
    nodes.value = response || []
  } catch (error) {
    console.error('Failed to fetch nodes:', error)
  } finally {
    loading.value = false
  }
}

// 取得當前選擇的節點 (從 cookie)
function loadCurrentNode() {
  if (typeof document !== 'undefined') {
    const cookies = document.cookie.split(';')
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === 'selected_node') {
        selectedNodeId.value = value || 'auto'
        return
      }
    }
  }
  selectedNodeId.value = 'auto'
}

// 選擇節點
async function selectNode(node: Node) {
  try {
    await $fetch('/api/cluster/switch', {
      method: 'POST',
      body: { node: node.nodeId }
    })
    selectedNodeId.value = node.nodeId
    showModal.value = false
    
    toast.add({
      title: 'Node Switched',
      description: `Now using ${node.nodeName || node.nodeId}`,
      color: 'success'
    })
    
    // 重新載入頁面
    setTimeout(() => window.location.reload(), 500)
  } catch (error) {
    console.error('Failed to switch node:', error)
    toast.add({
      title: 'Error',
      description: 'Failed to switch node',
      color: 'error'
    })
  }
}

// 使用自動模式
async function useAutoMode() {
  try {
    await $fetch('/api/cluster/switch', {
      method: 'POST',
      body: { node: 'auto' }
    })
    selectedNodeId.value = 'auto'
    showModal.value = false
    
    toast.add({
      title: 'Auto Mode',
      description: 'Now using load balancer',
      color: 'success'
    })
  } catch (error) {
    console.error('Failed to switch to auto mode:', error)
  }
}

// Watch modal open
watch(showModal, async (isOpen) => {
  if (isOpen) {
    await fetchNodes()
  }
})

// 初始化
onMounted(() => {
  loadCurrentNode()
  fetchNodes()
})
</script>

<style scoped>
/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95);
}
</style>
