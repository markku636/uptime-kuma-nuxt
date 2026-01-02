<script setup lang="ts">
const toast = useToast()
const tags = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingTag = ref<any>(null)
const form = ref({ name: '', color: '#5cdd8b' })

const colorOptions = ['#5cdd8b', '#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#ec4899', '#14b8a6', '#6b7280']

onMounted(async () => { await fetchTags() })

async function fetchTags() {
  loading.value = true
  try { tags.value = await $fetch('/api/v1/tags') as any[] }
  catch (error: any) { toast.add({ title: 'Error', description: error.data?.message || 'Failed to load', color: 'error' }) }
  finally { loading.value = false }
}

function openAddForm() {
  editingTag.value = null
  form.value = { name: '', color: '#5cdd8b' }
  showForm.value = true
}

function openEditForm(tag: any) {
  editingTag.value = tag
  form.value = { name: tag.name, color: tag.color }
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingTag.value) {
      await $fetch(`/api/v1/tags/${editingTag.value.id}`, { method: 'PUT', body: form.value })
      toast.add({ title: 'Success', description: 'Tag updated', color: 'success' })
    } else {
      await $fetch('/api/v1/tags', { method: 'POST', body: form.value })
      toast.add({ title: 'Success', description: 'Tag created', color: 'success' })
    }
    showForm.value = false
    await fetchTags()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

async function deleteTag(id: number) {
  if (!confirm('Delete this tag?')) return
  try {
    await $fetch(`/api/v1/tags/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Tag deleted', color: 'success' })
    await fetchTags()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-white">Tags</h4>
      <button class="btn btn-primary" @click="openAddForm">Add Tag</button>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

    <div v-else-if="tags.length === 0" class="section-card text-center py-8">
      <p class="text-gray-400 mb-4">No tags created yet.</p>
      <button class="btn btn-primary" @click="openAddForm">Create Your First Tag</button>
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div v-for="tag in tags" :key="tag.id" class="p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div class="flex items-center gap-2 mb-3">
          <span class="w-4 h-4 rounded-full" :style="{ backgroundColor: tag.color }"></span>
          <span class="text-white font-medium">{{ tag.name }}</span>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary text-sm flex-1" @click="openEditForm(tag)">Edit</button>
          <button class="btn btn-danger text-sm flex-1" @click="deleteTag(tag.id)">Delete</button>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">{{ editingTag ? 'Edit' : 'Add' }} Tag</h3>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input v-model="form.name" type="text" class="input-field" placeholder="Tag name" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Color</label>
            <div class="flex gap-2 flex-wrap">
              <button v-for="color in colorOptions" :key="color" type="button"
                class="w-8 h-8 rounded-full border-2 transition-all"
                :class="form.color === color ? 'border-white scale-110' : 'border-transparent'"
                :style="{ backgroundColor: color }"
                @click="form.color = color">
              </button>
            </div>
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">{{ editingTag ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
