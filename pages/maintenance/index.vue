<template>
  <transition name="slide-fade" appear>
    <div class="maintenance-page">
      <h1 class="page-title">Maintenance</h1>

      <div class="mb-3">
        <button class="btn btn-primary" @click="openAddModal">
          <UIcon name="i-heroicons-plus" class="me-1" />
          Schedule Maintenance
        </button>
      </div>

      <div class="shadow-box">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
        </div>

        <template v-else-if="maintenances.length > 0">
          <div v-for="maintenance in maintenances" :key="maintenance.id" class="item">
            <div class="item-info">
              <div class="item-header">
                <span class="item-title">{{ maintenance.title }}</span>
                <span class="badge" :class="maintenance.active ? 'badge-success' : 'badge-secondary'">
                  {{ maintenance.active ? 'Active' : 'Paused' }}
                </span>
                <span class="badge badge-info">{{ formatStrategy(maintenance.strategy) }}</span>
              </div>
              <p v-if="maintenance.description" class="item-description">{{ maintenance.description }}</p>
              <div class="item-meta">
                <span v-if="maintenance.startDate">
                  <UIcon name="i-heroicons-calendar" class="icon-inline" />
                  {{ formatDate(maintenance.startDate) }}
                </span>
                <span v-if="maintenance.duration">
                  <UIcon name="i-heroicons-clock" class="icon-inline" />
                  {{ maintenance.duration }} min
                </span>
                <span v-if="maintenance.cron">
                  <UIcon name="i-heroicons-arrow-path" class="icon-inline" />
                  {{ maintenance.cron }}
                </span>
              </div>
            </div>
            <div class="item-actions">
              <button class="btn btn-sm btn-outline" @click="toggleMaintenance(maintenance)">
                {{ maintenance.active ? 'Pause' : 'Resume' }}
              </button>
              <button class="btn btn-sm btn-outline" @click="editMaintenance(maintenance)">
                Edit
              </button>
              <button class="btn btn-sm btn-outline text-danger" @click="deleteMaintenance(maintenance)">
                Delete
              </button>
            </div>
          </div>
        </template>

        <div v-else class="empty-state">
          No scheduled maintenance
        </div>
      </div>

      <!-- Add/Edit Modal -->
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5>{{ editingMaintenance ? 'Edit Maintenance' : 'Schedule Maintenance' }}</h5>
              <button class="btn-close" @click="showModal = false">&times;</button>
            </div>
            <div class="modal-body">
              <form @submit.prevent="saveMaintenance">
                <div class="mb-4">
                  <label class="form-label">Title</label>
                  <input v-model="form.title" type="text" class="form-control" required />
                </div>

                <div class="mb-4">
                  <label class="form-label">Description</label>
                  <textarea v-model="form.description" class="form-control" rows="2"></textarea>
                </div>

                <div class="mb-4">
                  <label class="form-label">Strategy</label>
                  <select v-model="form.strategy" class="form-select">
                    <option v-for="opt in strategyOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>

                <div v-if="form.strategy !== 'manual'" class="row">
                  <div class="col">
                    <div class="mb-4">
                      <label class="form-label">Start Date</label>
                      <input v-model="form.startDate" type="datetime-local" class="form-control" />
                    </div>
                  </div>
                  <div v-if="form.strategy === 'single'" class="col">
                    <div class="mb-4">
                      <label class="form-label">End Date</label>
                      <input v-model="form.endDate" type="datetime-local" class="form-control" />
                    </div>
                  </div>
                </div>

                <div v-if="form.strategy === 'cron'" class="mb-4">
                  <label class="form-label">Cron Expression</label>
                  <input v-model="form.cron" type="text" class="form-control" placeholder="0 2 * * *" />
                  <div class="form-text">e.g., "0 2 * * *" for 2 AM daily</div>
                </div>

                <div class="row">
                  <div class="col">
                    <div class="mb-4">
                      <label class="form-label">Duration (minutes)</label>
                      <input v-model.number="form.duration" type="number" class="form-control" min="1" />
                    </div>
                  </div>
                  <div class="col">
                    <div class="mb-4">
                      <label class="form-label">Timezone</label>
                      <select v-model="form.timezone" class="form-select">
                        <option v-for="opt in timezoneOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="modal-footer">
                  <button type="button" class="btn btn-outline" @click="showModal = false">Cancel</button>
                  <button type="submit" class="btn btn-primary" :disabled="saving">
                    {{ saving ? 'Saving...' : editingMaintenance ? 'Save Changes' : 'Create' }}
                  </button>
                </div>
              </form>
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

const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const showModal = ref(false)
const maintenances = ref<any[]>([])
const editingMaintenance = ref<any>(null)

const form = reactive({
  title: '',
  description: '',
  strategy: 'manual',
  startDate: '',
  endDate: '',
  cron: '',
  duration: 60,
  timezone: 'UTC'
})

const strategyOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'single', label: 'Single Occurrence' },
  { value: 'recurring-interval', label: 'Recurring - Interval' },
  { value: 'recurring-weekday', label: 'Recurring - Weekday' },
  { value: 'recurring-day-of-month', label: 'Recurring - Day of Month' },
  { value: 'cron', label: 'Cron Expression' }
]

const timezoneOptions = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
  { value: 'Asia/Taipei', label: 'Asia/Taipei' }
]

onMounted(async () => {
  await fetchMaintenances()
})

async function fetchMaintenances() {
  loading.value = true
  try {
    const response = await $fetch('/api/v1/maintenances')
    maintenances.value = (response as any).data || []
  } catch (error) {
    console.error('Failed to fetch maintenances:', error)
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingMaintenance.value = null
  Object.assign(form, {
    title: '',
    description: '',
    strategy: 'manual',
    startDate: '',
    endDate: '',
    cron: '',
    duration: 60,
    timezone: 'UTC'
  })
  showModal.value = true
}

function editMaintenance(maintenance: any) {
  editingMaintenance.value = maintenance
  Object.assign(form, {
    title: maintenance.title,
    description: maintenance.description || '',
    strategy: maintenance.strategy,
    startDate: maintenance.startDate ? new Date(maintenance.startDate).toISOString().slice(0, 16) : '',
    endDate: maintenance.endDate ? new Date(maintenance.endDate).toISOString().slice(0, 16) : '',
    cron: maintenance.cron || '',
    duration: maintenance.duration,
    timezone: maintenance.timezone
  })
  showModal.value = true
}

async function saveMaintenance() {
  saving.value = true
  try {
    const data = { ...form }
    
    if (editingMaintenance.value) {
      await $fetch(`/api/v1/maintenances/${editingMaintenance.value.id}`, {
        method: 'PUT',
        body: data
      })
      toast.add({ title: 'Success', description: 'Maintenance updated', color: 'success' })
    } else {
      await $fetch('/api/v1/maintenances', {
        method: 'POST',
        body: data
      })
      toast.add({ title: 'Success', description: 'Maintenance created', color: 'success' })
    }
    
    showModal.value = false
    await fetchMaintenances()
  } catch (error: any) {
    toast.add({ 
      title: 'Error', 
      description: error.data?.message || 'Failed to save maintenance', 
      color: 'error' 
    })
  } finally {
    saving.value = false
  }
}

async function toggleMaintenance(maintenance: any) {
  try {
    const action = maintenance.active ? 'pause' : 'resume'
    await $fetch(`/api/v1/maintenances/${maintenance.id}/${action}`, {
      method: 'POST'
    })
    await fetchMaintenances()
    toast.add({ 
      title: 'Success', 
      description: `Maintenance ${action}d`, 
      color: 'success' 
    })
  } catch (error: any) {
    toast.add({ 
      title: 'Error', 
      description: error.data?.message || 'Operation failed', 
      color: 'error' 
    })
  }
}

async function deleteMaintenance(maintenance: any) {
  if (!confirm(`Delete "${maintenance.title}"?`)) return
  
  try {
    await $fetch(`/api/v1/maintenances/${maintenance.id}`, {
      method: 'DELETE'
    })
    await fetchMaintenances()
    toast.add({ title: 'Success', description: 'Maintenance deleted', color: 'success' })
  } catch (error: any) {
    toast.add({ 
      title: 'Error', 
      description: error.data?.message || 'Failed to delete', 
      color: 'error' 
    })
  }
}

function formatStrategy(strategy: string): string {
  const map: Record<string, string> = {
    'manual': 'Manual',
    'single': 'One-time',
    'recurring-interval': 'Interval',
    'recurring-weekday': 'Weekly',
    'recurring-day-of-month': 'Monthly',
    'cron': 'Cron'
  }
  return map[strategy] || strategy
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString()
}
</script>

<style scoped>
.slide-fade-enter-active { transition: all 0.3s ease-out; }
.slide-fade-leave-active { transition: all 0.2s ease-in; }
.slide-fade-enter-from, .slide-fade-leave-to { transform: translateY(10px); opacity: 0; }

.maintenance-page { padding: 20px; }

.page-title {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 20px;
  color: #212529;
}
.dark .page-title { color: #c9d1d9; }

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

.btn-primary { background: #5cdd8b; color: white; border-color: #5cdd8b; }
.btn-primary:hover { background: #4cc77a; }
.btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

.btn-outline { background: transparent; border-color: #dee2e6; color: #212529; }
.dark .btn-outline { border-color: #30363d; color: #c9d1d9; }
.btn-outline:hover { background: #f8f9fa; }
.dark .btn-outline:hover { background: #30363d; }

.btn-sm { padding: 4px 12px; font-size: 0.8rem; }
.text-danger { color: #dc3545 !important; }

.shadow-box {
  background: white;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 10px;
}
.dark .shadow-box { background: #21262d; }

.loading-state, .empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #6c757d;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #5cdd8b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 15px;
  border-radius: 8px;
  transition: background 0.15s;
}
.item:hover { background: #f8f9fa; }
.dark .item:hover { background: #30363d; }

.item-info { flex: 1; }

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.item-title {
  font-weight: bold;
  font-size: 1rem;
  color: #212529;
}
.dark .item-title { color: #c9d1d9; }

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
}
.badge-success { background: #28a745; color: white; }
.badge-secondary { background: #6c757d; color: white; }
.badge-info { background: #1e90ff; color: white; }

.item-description {
  font-size: 0.875rem;
  color: #6c757d;
  margin: 4px 0;
}

.item-meta {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 8px;
}

.icon-inline {
  width: 14px;
  height: 14px;
  vertical-align: middle;
  margin-right: 4px;
}

.item-actions {
  display: flex;
  gap: 8px;
}

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
.modal-lg { max-width: 600px; }

.modal-content {
  background: white;
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}
.dark .modal-content { background: #21262d; }

.modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dark .modal-header { border-color: #30363d; }
.modal-header h5 { margin: 0; font-weight: 600; color: #212529; }
.dark .modal-header h5 { color: #c9d1d9; }

.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #6c757d;
}

.modal-body { padding: 20px; }

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #dee2e6;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.dark .modal-footer { border-color: #30363d; }

.row { display: flex; gap: 16px; flex-wrap: wrap; }
.col { flex: 1; min-width: 200px; }

.form-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: #212529;
}
.dark .form-label { color: #c9d1d9; }

.form-control,
.form-select {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 1rem;
  line-height: 1.5;
  color: #212529;
  background-color: #fff;
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
}
.dark .form-control,
.dark .form-select {
  background-color: #1a1d21;
  border-color: #30363d;
  color: #c9d1d9;
}
.form-control:focus,
.form-select:focus {
  border-color: #5cdd8b;
  outline: 0;
  box-shadow: 0 0 0 0.2rem rgba(92, 221, 139, 0.25);
}

textarea.form-control { resize: vertical; }

.form-text { font-size: 0.875rem; color: #6c757d; margin-top: 0.25rem; }
</style>
