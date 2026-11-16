<template>
  <transition name="slide-fade" appear>
    <div class="status-pages">
      <h1 class="page-title">Status Pages</h1>

      <div class="mb-3">
        <button class="btn btn-primary" @click="openAddModal">
          <UIcon name="i-heroicons-plus" class="me-1" />
          New Status Page
        </button>
      </div>

      <div class="shadow-box">
        <div v-if="pending" class="loading-state">
          <div class="spinner"></div>
        </div>

        <template v-else-if="statusPages.length > 0">
          <a
            v-for="page in statusPages"
            :key="page.id"
            :href="`/status/${page.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="item"
          >
            <img src="/icon.svg" alt="" class="logo" />
            <div class="info">
              <div class="title">
                {{ page.title }}
                <span v-if="!page.published" class="draft-badge">Draft</span>
              </div>
              <div class="slug">/status/{{ page.slug }}</div>
            </div>
            <div class="actions">
              <button class="btn btn-sm btn-outline" @click.prevent="openEditModal(page)">
                Edit
              </button>
              <button class="btn btn-sm btn-outline text-danger" @click.prevent="openDeleteModal(page)">
                Delete
              </button>
            </div>
          </a>
        </template>

        <div v-else class="empty-state">
          No status pages
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5>{{ editingStatusPage ? 'Edit Status Page' : 'Add New Status Page' }}</h5>
              <button class="btn-close" @click="showModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <form @submit.prevent="handleSubmit(formData)">
                <div class="mb-4">
                  <label class="form-label">Title</label>
                  <input v-model="formData.title" type="text" class="form-control" required />
                </div>
                <div class="mb-4">
                  <label class="form-label">Slug</label>
                  <input v-model="formData.slug" type="text" class="form-control" required />
                  <div class="form-text">URL: /status/{{ formData.slug || 'your-slug' }}</div>
                </div>
                <div class="mb-4">
                  <label class="form-label">Description</label>
                  <textarea v-model="formData.description" class="form-control" rows="3"></textarea>
                </div>
                <div class="mb-4">
                  <div class="form-check">
                    <input id="published" v-model="formData.published" type="checkbox" class="form-check-input" />
                    <label class="form-check-label" for="published">Published</label>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-outline" @click="showModal = false">Cancel</button>
                  <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
                    {{ isSubmitting ? 'Saving...' : 'Save' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <!-- Delete Confirmation Modal -->
      <div v-if="showDeleteModal" class="modal-overlay" @click.self="showDeleteModal = false">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5>Delete Status Page</h5>
            </div>
            <div class="modal-body">
              Are you sure you want to delete "{{ deletingStatusPage?.title }}"?
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" @click="showDeleteModal = false">No</button>
              <button class="btn btn-danger" @click="handleDelete">Yes</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

interface StatusPage {
  id: number
  slug: string
  title: string
  description: string | null
  theme: string
  published: boolean
  showTags: boolean
  customCSS: string | null
  googleAnalyticsId: string | null
  createdAt: string
  updatedAt: string
  monitors: any[]
}

const toast = useToast()
const showModal = ref(false)
const showDeleteModal = ref(false)
const editingStatusPage = ref<StatusPage | null>(null)
const deletingStatusPage = ref<StatusPage | null>(null)
const isSubmitting = ref(false)

const formData = reactive({
  title: '',
  slug: '',
  description: '',
  published: true
})

interface ApiResponse {
  ok: boolean
  data: StatusPage[]
}

const { data: response, pending, refresh } = await useFetch<ApiResponse>('/api/v1/status-pages')
const statusPages = computed(() => response.value?.data || [])

function openAddModal() {
  editingStatusPage.value = null
  formData.title = ''
  formData.slug = ''
  formData.description = ''
  formData.published = true
  showModal.value = true
}

function openEditModal(statusPage: StatusPage) {
  editingStatusPage.value = statusPage
  formData.title = statusPage.title
  formData.slug = statusPage.slug
  formData.description = statusPage.description || ''
  formData.published = statusPage.published
  showModal.value = true
}

function openDeleteModal(statusPage: StatusPage) {
  deletingStatusPage.value = statusPage
  showDeleteModal.value = true
}

async function handleSubmit(data: any) {
  isSubmitting.value = true
  try {
    if (editingStatusPage.value) {
      await $fetch(`/api/v1/status-pages/${editingStatusPage.value.slug}`, {
        method: 'PUT',
        body: data
      })
      toast.add({ title: 'Success', description: 'Status page updated', color: 'success' })
    } else {
      await $fetch('/api/v1/status-pages', {
        method: 'POST',
        body: data
      })
      toast.add({ title: 'Success', description: 'Status page created', color: 'success' })
    }
    showModal.value = false
    refresh()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (!deletingStatusPage.value) return
  
  try {
    await $fetch(`/api/v1/status-pages/${deletingStatusPage.value.slug}`, {
      method: 'DELETE'
    })
    toast.add({ title: 'Success', description: 'Status page deleted', color: 'success' })
    showDeleteModal.value = false
    deletingStatusPage.value = null
    refresh()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}
</script>

<style scoped>
.slide-fade-enter-active { transition: all 0.3s ease-out; }
.slide-fade-leave-active { transition: all 0.2s ease-in; }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(10px); opacity: 0; }

.status-pages { padding: 20px; }

.page-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 20px;
  color: var(--uk-text);
}

.mb-3 { margin-bottom: 16px; }
.mb-4 { margin-bottom: 1.5rem; }
.me-1 { margin-right: 4px; }

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  text-decoration: none;
  transition: all 0.15s;
}

.btn-primary { background: var(--uk-primary); color: var(--uk-text-on-primary); border-color: var(--uk-primary); }
.btn-primary:hover { background: var(--uk-primary-hover); }
.btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

.btn-outline { background: transparent; border-color: var(--uk-border); color: var(--uk-text); }
.btn-outline:hover { background: var(--uk-bg-sunken); }

.btn-danger { background: var(--uk-status-down); border-color: var(--uk-status-down); color: white; }
.btn-danger:hover { background: var(--uk-red-700); }

.btn-sm { padding: 4px 12px; font-size: 0.8rem; }
.text-danger { color: var(--uk-status-down-fg) !important; }

.shadow-box {
  background: white;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 10px;
}

.loading-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--uk-text-muted);
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid var(--uk-border);
  border-top: 3px solid var(--uk-status-up);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.item {
  display: flex;
  align-items: center;
  gap: 15px;
  text-decoration: none;
  border-radius: 10px;
  padding: 15px;
  transition: background 0.15s;
  color: inherit;
}
.item:hover { background: var(--uk-bg-sunken); }

.logo { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; }

.info { flex: 1; }
.info .title {
  font-weight: bold;
  font-size: 1.1rem;
  color: var(--uk-text);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.info .slug { font-size: 0.875rem; color: var(--uk-text-muted); }

.draft-badge {
  font-size: 0.7rem;
  padding: 2px 6px;
  background: var(--uk-status-unknown);
  color: white;
  border-radius: 4px;
  font-weight: normal;
}

.actions { display: flex; gap: 8px; }

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-dialog { max-width: 500px; width: 90%; }

.modal-content {
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--uk-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h5 { margin: 0; font-weight: 600; color: var(--uk-text); }

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--uk-text-muted);
}

.modal-body { padding: 20px; }

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--uk-border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--uk-text);
}

.form-control {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--uk-text);
  background-color: var(--uk-bg-surface);
  border: 1px solid var(--uk-border-strong);
  border-radius: 0.375rem;
}
.form-control:focus {
  border-color: var(--uk-status-up);
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(92, 221, 139, 0.25);
}

textarea.form-control { resize: vertical; }

.form-text { font-size: 0.875rem; color: var(--uk-text-muted); margin-top: 0.25rem; }

.form-check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.form-check-input { width: 1rem; height: 1rem; cursor: pointer; }
.form-check-label { cursor: pointer; color: var(--uk-text); }
</style>
